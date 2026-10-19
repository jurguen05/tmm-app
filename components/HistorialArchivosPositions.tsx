'use client'

import { supabase } from '../lib/supabase'
import { FileUpload } from '../types'
import { reprocessUploadedFile, processPositionsUpload } from '../services/fileUploadService'
import { ModuleFileHistoryCard } from './ModuleFileHistoryCard'

export default function HistorialArchivosPositions() {
  return (
    <ModuleFileHistoryCard
      title="Positions CSV"
      moduleType="positions"
      allowPagination={true}
      processingMessage="Processing position statement..."
      emptyMessage="No files uploaded recently."
      deleteConfirmMessage={(fileName) =>
        `Are you sure you want to delete "${fileName}"?\n\nThis will remove the associated positions snapshot.`
      }
      onUpload={(file) => processPositionsUpload(file, supabase)}
      onReprocess={(archivo: FileUpload) => reprocessUploadedFile(archivo, supabase)}
      reprocessButtonLabel="Restore"
      reprocessConfirmMessage={(fileName) =>
        `Do you want to restore "${fileName}"?\n\nThis will replace the current positions snapshot with this file.`
      }
    />
  )
}