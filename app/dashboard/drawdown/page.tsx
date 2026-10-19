import { ComingSoonModule } from '@/components/ComingSoonModule'

export default function DrawdownPage() {
  return (
    <ComingSoonModule
      icon="📉"
      iconColorClass="bg-rose-50 text-rose-600"
      title="Drawdown Tracker"
      description="Continuous peak-to-trough drawdown tracking, recovery duration, underwater equity curve, and max historical drawdown metrics."
    />
  )
}
