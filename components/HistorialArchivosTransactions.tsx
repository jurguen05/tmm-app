'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { processTransactionsUpload } from '../services/fileUploadService'
import ReviewNewTradesModal from './ReviewNewTradesModal'
import { ModuleFileHistoryCard } from './ModuleFileHistoryCard'

export default function HistorialArchivosTransactions() {
  const router = useRouter()
  const [reviewTradeCodes, setReviewTradeCodes] = useState<number[]>([])
  const [reviewModalOpen, setReviewModalOpen] = useState(false)

  const notifyTransactionsChanged = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transactions-changed'))
    }
  }

  return (
    <>
      <ModuleFileHistoryCard
        title="Transactions CSV"
        moduleType="transactions"
        initialLimit={3}
        processingMessage="Processing transaction file..."
        emptyMessage="No files uploaded recently."
        renderFileName={(archivo) =>
          archivo.file_name.replace(/.*(Transactions_\d+)-.*/, '$1.csv')
        }
        deleteConfirmMessage={(fileName) =>
          `Are you sure you want to delete "${fileName}"?\n\nThis will remove all associated transactions. This action cannot be undone.`
        }
        onUpload={(file) => processTransactionsUpload(file, supabase)}
        onUploadSuccess={(result) => {
          notifyTransactionsChanged()
          if (result.tradeCodes && result.tradeCodes.length > 0) {
            setReviewTradeCodes(result.tradeCodes)
            setReviewModalOpen(true)
          }
        }}
        onAfterDelete={() => {
          notifyTransactionsChanged()
        }}
      />

      {reviewModalOpen && (
        <ReviewNewTradesModal
          isOpen={reviewModalOpen}
          tradeCodes={reviewTradeCodes}
          onClose={() => setReviewModalOpen(false)}
          onSaved={() => {
            setReviewModalOpen(false)
            router.refresh()
            notifyTransactionsChanged()
          }}
        />
      )}
    </>
  )
}