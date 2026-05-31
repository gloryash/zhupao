import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Footprints, Plus, RefreshCw, X } from 'lucide-react'
import { EmptyState, LoadingBlock, Spinner } from '../components/ui'
import { OrderCard } from '../components/OrderCard'
import { useToast } from '../components/Toast'
import { CloudError, cancelOrder, getMyOrders } from '../services/api'
import { isActiveOrder } from '../lib/format'
import type { Order } from '../types'
import type { PageProps } from './types'

type Filter = 'all' | 'active' | 'completed'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' }
]

/** Order tab. Runners (视障跑者) see their published requests with status
 *  filters and a cancel action; volunteers are pointed to the 接单 board. */
export function OrdersPage(props: PageProps) {
  return props.role === 'volunteer' ? <VolunteerOrders {...props} /> : <RunnerOrders {...props} />
}

/* ============================ Runner (视障跑者) ============================ */

function RunnerOrders({ onNavigate }: PageProps) {
  const toast = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setOrders(await getMyOrders())
    } catch (err) {
      setError(true)
      if (err instanceof CloudError) toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const cancel = useCallback(
    async (order: Order) => {
      if (busyId) return
      setBusyId(order._id)
      try {
        await cancelOrder(order._id)
        toast.success('已取消该陪跑请求')
        await load()
      } catch (err) {
        toast.error(err instanceof CloudError ? err.message : '取消失败，请稍后再试')
      } finally {
        setBusyId(null)
      }
    },
    [busyId, load, toast]
  )

  const filtered = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'completed') return orders.filter((o) => o.status === 'completed')
    return orders.filter((o) => isActiveOrder(o.status))
  }, [orders, filter])

  if (loading) {
    return <LoadingBlock label="正在加载你的订单…" />
  }

  return (
    <div className="stack stagger">
      <div className="row row--between" style={{ padding: '0 2px' }}>
        <span className="section-title" style={{ margin: 0 }}>
          <ClipboardList size={18} /> 我的订单
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => void load()}
          aria-label="刷新"
        >
          <RefreshCw size={15} /> 刷新
        </button>
      </div>

      <div className="segmented" role="tablist" aria-label="订单筛选">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <section className="card" style={{ textAlign: 'center' }}>
          <p className="empty__title">没能加载订单</p>
          <p className="empty__text" style={{ marginBottom: 16 }}>
            请检查网络连接后重试。
          </p>
          <button type="button" className="btn btn--accent btn--sm" onClick={() => void load()}>
            <RefreshCw size={16} /> 刷新重试
          </button>
        </section>
      ) : filtered.length === 0 ? (
        <>
          <EmptyState
            icon={<ClipboardList size={26} />}
            title={filter === 'all' ? '还没有陪跑订单' : '该分类下暂无订单'}
            text="发起一次陪跑后，订单与实时状态会显示在这里。"
          />
          <button
            type="button"
            className="btn btn--accent btn--block"
            onClick={() => onNavigate('sport')}
          >
            <Plus size={18} /> 发起一次陪跑
          </button>
        </>
      ) : (
        filtered.map((order) => (
          <OrderCard key={order._id} order={order}>
            {isActiveOrder(order.status) && (
              <button
                type="button"
                className="btn btn--coral btn--sm btn--block"
                onClick={() => void cancel(order)}
                disabled={busyId === order._id}
              >
                {busyId === order._id ? <Spinner /> : <X size={16} />}
                {busyId === order._id ? '取消中…' : '取消请求'}
              </button>
            )}
          </OrderCard>
        ))
      )}
    </div>
  )
}

/* =========================== Volunteer (志愿者) =========================== */

function VolunteerOrders({ onNavigate }: PageProps) {
  return (
    <div className="stack stagger">
      <EmptyState
        icon={<Footprints size={26} />}
        title="订单在「接单」中处理"
        text="你接受与进行中的陪跑订单都在接单广场，前往即可查看与操作。"
      />
      <button
        type="button"
        className="btn btn--pine btn--block"
        onClick={() => onNavigate('sport')}
      >
        <Footprints size={18} /> 前往接单广场
      </button>
    </div>
  )
}
