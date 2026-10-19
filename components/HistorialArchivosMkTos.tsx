'use client'

import { supabase } from '../lib/supabase'
import { processMkTosUpload } from '../services/fileUploadService'
import { ModuleFileHistoryCard } from './ModuleFileHistoryCard'

export default function HistorialArchivosMkTos() {
  return (
    <ModuleFileHistoryCard
      title="Mk-Tos CSV"
      moduleType="mk-tos"
      initialLimit={3}
      processingMessage="Processing quote file..."
      emptyMessage="No files imported yet."
      deleteConfirmMessage={(fileName) =>
        `Are you sure you want to delete "${fileName}"?\n\nThis will permanently delete the file and ALL its quotes from the database.`
      }
      onUpload={(file) => processMkTosUpload(file, supabase)}
    />
  )
}