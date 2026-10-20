// scripts/bulk_archive_mktos.mjs
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

// 1. Validar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31m[ERROR]\x1b[0m Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('Asegúrate de ejecutar el script con: node --env-file=.env.local scripts/bulk_archive_mktos.mjs <carpeta>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Helpers de parsing idénticos a la app
function normalizeNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const str = value.toString().trim();
  if (!str || str.toLowerCase().includes('loading') || str.toLowerCase() === 'n/a') return 0;
  const cleanStr = str.replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

function parsearFechaTOS(rawDate) {
  if (!rawDate) return null;
  const isoMatch = rawDate.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return isoMatch[0];

  const matches = [...rawDate.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const mm = lastMatch[1].padStart(2, '0');
    const dd = lastMatch[2].padStart(2, '0');
    let yyyy = lastMatch[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function limpiarTextoCsv(csvText) {
  if (!csvText) return '';
  const sinBom = csvText.replace(/^\uFEFF/, '');
  const lineas = sinBom.split(/\r?\n/);
  const lineasLimpias = lineas.map(linea => {
    let l = linea.trim();
    if (l.startsWith('"""') && l.endsWith('"""')) {
      l = l.substring(1, l.length - 1).replace(/""/g, '"');
    } else if (l.startsWith('"') && l.endsWith('"') && l.includes('""') && !l.includes('","')) {
      l = l.substring(1, l.length - 1).replace(/""/g, '"');
    }
    return l;
  });
  return lineasLimpias.join('\n');
}

function procesarFilasMkTos(csvData, quoteDate, fileUploadId) {
  const filas = [];
  for (const row of csvData) {
    const symbol = row['Symbol'];
    if (!symbol || symbol.includes('Symbol') || symbol.trim() === '') continue;

    const fila = {
      quote_date: quoteDate,
      symbol: symbol.trim().toUpperCase(),
      description: row['Description']?.trim() || '',
      last_price: normalizeNumber(row['Last']),
      high_52: normalizeNumber(row['52High']),
      low_52: normalizeNumber(row['52Low']),
      ema: normalizeNumber(row['MovAvgExponential']),
      low_100_day: normalizeNumber(row['100-day-Low']),
      high_price: normalizeNumber(row['High']),
      low_price: normalizeNumber(row['Low']),
      bollinger_bands: normalizeNumber(row['BBO'] ?? row['BollingerBands'] ?? row['BBO_STOP'] ?? row['Bollinger Bands']),
      sma_10w: normalizeNumber(row['SMA 10W']),
      mac_stop: normalizeNumber(row['MAC_STOP']),
      trendpilot_stop: normalizeNumber(row['TrendPilot_STOP']),
      sma_10d: normalizeNumber(row['SMA 10d']),
      sma_100d: normalizeNumber(row['SMA 100d']),
      file_upload_id: fileUploadId
    };
    filas.push(fila);
  }
  return filas;
}

// 3. Proceso individual de archivo
async function procesarArchivoCsv(filePath) {
  const fileName = path.basename(filePath);
  
  // A. Comprobar si ya existe en file_uploads
  const { data: existing, error: checkErr } = await supabase
    .from('file_uploads')
    .select('id, is_archived, storage_path')
    .eq('file_name', fileName)
    .eq('module', 'mk-tos')
    .maybeSingle();

  if (checkErr) {
    throw new Error(`Error al verificar existencia de ${fileName}: ${checkErr.message}`);
  }

  if (existing) {
    if (existing.is_archived) {
      return { status: 'skipped', reason: 'Ya existía y ya está archivado' };
    }
    // Si ya existe pero no estaba archivado, actualizarlo
    const { error: updErr } = await supabase
      .from('file_uploads')
      .update({ is_archived: true })
      .eq('id', existing.id);

    if (updErr) throw updErr;
    return { status: 'updated', reason: 'Existía en base de datos; marcado como archivado (is_archived = true)' };
  }

  // B. Leer y parsear el archivo CSV
  const fileBuffer = fs.readFileSync(filePath);
  const csvText = fileBuffer.toString('utf-8');
  const lineas = csvText.split(/\r?\n/);
  
  const quoteDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(fileName) || new Date().toISOString().split('T')[0];
  const year = quoteDate.split('-')[0] || '2026';
  const storagePath = `${year}/${fileName}`;

  let headerIndex = 0;
  for (let i = 0; i < lineas.length; i++) {
    const cleanLine = lineas[i].replace(/"/g, '').trim();
    if (cleanLine.startsWith('Symbol,Description') || cleanLine.startsWith('Symbol,')) {
      headerIndex = i;
      break;
    }
  }

  const csvLimpio = limpiarTextoCsv(lineas.slice(headerIndex).join('\n'));
  const parseResult = Papa.parse(csvLimpio, { header: true, skipEmptyLines: true });
  const filasProcesadas = procesarFilasMkTos(parseResult.data, quoteDate);

  if (filasProcesadas.length === 0) {
    return { status: 'skipped', reason: 'Sin cotizaciones válidas' };
  }

  // C. Subir a Supabase Storage (Bucket 'Mk-tos' en carpeta correspondiente al año, ej: 2026/)
  const { error: uploadErr } = await supabase.storage
    .from('Mk-tos')
    .upload(storagePath, fileBuffer, {
      contentType: 'text/csv',
      cacheControl: '3600',
      upsert: true
    });

  if (uploadErr) {
    throw new Error(`Error al subir a Supabase Storage: ${uploadErr.message}`);
  }

  // D. Insertar en file_uploads con is_archived = true directamente
  let fileRecordId = null;
  try {
    const { data: record, error: dbErr } = await supabase
      .from('file_uploads')
      .insert({
        file_name: fileName,
        module: 'mk-tos',
        storage_path: storagePath,
        is_archived: true
      })
      .select('id')
      .single();

    if (dbErr) throw dbErr;
    fileRecordId = record.id;

    // Asignar file_upload_id a las filas
    for (const fila of filasProcesadas) {
      fila.file_upload_id = fileRecordId;
    }

    // E. Insertar cotizaciones en lotes de 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < filasProcesadas.length; i += BATCH_SIZE) {
      const batch = filasProcesadas.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase
        .from('mk_tos_quotes')
        .insert(batch);

      if (insertErr) throw insertErr;
    }

    // F. Registrar SPY diario en spy_daily_closes (Weekend Trader market filter)
    const spyRow = filasProcesadas.find(f => f.symbol === 'SPY');
    if (spyRow && spyRow.last_price > 0 && spyRow.sma_10w > 0) {
      await supabase
        .from('spy_daily_closes')
        .upsert({
          quote_date: spyRow.quote_date,
          spy_last: spyRow.last_price,
          spy_sma_10w: spyRow.sma_10w,
          file_upload_id: fileRecordId
        }, { onConflict: 'quote_date' });
    }

    return {
      status: 'created',
      count: filasProcesadas.length,
      quoteDate,
      storagePath
    };
  } catch (error) {
    // Rollback si falló la inserción en base de datos
    if (fileRecordId) {
      await supabase.from('mk_tos_quotes').delete().eq('file_upload_id', fileRecordId);
      await supabase.from('file_uploads').delete().eq('id', fileRecordId);
    }
    await supabase.storage.from('Mk-tos').remove([storagePath]);
    throw error;
  }
}

// 4. Función principal
async function main() {
  const targetDir = process.argv[2];

  if (!targetDir) {
    console.log(`
\x1b[36m=== Ingesta Masiva y Archivado Lógico de Archivos MK-TOS ===\x1b[0m

Uso:
  node --env-file=.env.local scripts/bulk_archive_mktos.mjs <ruta_de_la_carpeta>

Ejemplo:
  node --env-file=.env.local scripts/bulk_archive_mktos.mjs "./archivos_historicos_2026"
  node --env-file=.env.local scripts/bulk_archive_mktos.mjs "C:\\Users\\tu_usuario\\Downloads\\Quotes_2026"
`);
    process.exit(1);
  }

  const resolvedDir = path.resolve(targetDir);
  if (!fs.existsSync(resolvedDir)) {
    console.error(`\x1b[31m[ERROR]\x1b[0m La carpeta especificada no existe: ${resolvedDir}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(resolvedDir);
  const csvFiles = allFiles
    .filter(f => f.toLowerCase().endsWith('.csv'))
    .map(f => path.join(resolvedDir, f));

  if (csvFiles.length === 0) {
    console.log(`\x1b[33m[AVISO]\x1b[0m No se encontraron archivos .csv en: ${resolvedDir}`);
    return;
  }

  console.log(`\x1b[36mIniciando procesamiento de ${csvFiles.length} archivos desde: ${resolvedDir}\x1b[0m\n`);

  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;
  let errores = 0;

  for (let i = 0; i < csvFiles.length; i++) {
    const file = csvFiles[i];
    const name = path.basename(file);
    process.stdout.write(`[${i + 1}/${csvFiles.length}] ${name} ... `);

    try {
      const res = await procesarArchivoCsv(file);
      if (res.status === 'created') {
        console.log(`\x1b[32m✔ SUBIDO Y ARCHIVADO\x1b[0m (${res.count} cotizaciones, fecha: ${res.quoteDate}, path: ${res.storagePath})`);
        creados++;
      } else if (res.status === 'updated') {
        console.log(`\x1b[33m✔ YA EXISTÍA -> MARCADO ARCHIVADO\x1b[0m (${res.reason})`);
        actualizados++;
      } else {
        console.log(`\x1b[90m- OMITIDO\x1b[0m (${res.reason})`);
        omitidos++;
      }
    } catch (err) {
      console.log(`\x1b[31m✖ ERROR\x1b[0m: ${err.message}`);
      errores++;
    }
  }

  console.log(`
\x1b[36m================ RESUMEN DE PROCESAMIENTO ================\x1b[0m
  Archivos nuevos subidos y archivados: ${creados}
  Archivos existentes marcados como archivados: ${actualizados}
  Archivos omitidos: ${omitidos}
  Archivos con error: ${errores}
  Total archivos evaluados: ${csvFiles.length}
==========================================================
`);
}

main().catch(err => {
  console.error('\n\x1b[31m[FATAL ERROR]\x1b[0m', err);
  process.exit(1);
});
