import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Footprints,
  GraduationCap,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  XCircle
} from 'lucide-react'
import { LoadingBlock, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import {
  CloudError,
  getCertificate,
  getExamQuestions,
  getTrainingStatus,
  markVideoWatched,
  submitExam,
  verifyCertificate
} from '../services/api'
import type { Certificate, ExamQuestion, ExamResult, TrainingStatus } from '../types'
import type { PageProps } from './types'

/** Volunteer certification tab — video → exam → certificate.
 *  Runners (视障跑者) never see this in the nav, but the page guards the role
 *  defensively and points them back to the runner flows. */
export function TrainingPage(props: PageProps) {
  return props.role === 'volunteer' ? <VolunteerTraining {...props} /> : <RunnerNotice {...props} />
}

/* ============================ Runner (视障跑者) ============================ */

function RunnerNotice({ onNavigate }: PageProps) {
  return (
    <div className="stack stagger">
      <section className="callout callout--sky">
        <div className="callout__icon">
          <GraduationCap size={20} />
        </div>
        <div>
          <p className="callout__title">陪跑认证仅面向志愿者</p>
          <p className="callout__text">
            培训与考核是为陪跑志愿者准备的。作为视障跑者，你可以直接发起陪跑或预约熟悉的志愿者，由认证志愿者全程陪伴。
          </p>
        </div>
      </section>

      <div className="stack stack--sm">
        <button type="button" className="btn btn--accent btn--block" onClick={() => onNavigate('sport')}>
          <Footprints size={18} /> 发起一次陪跑
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => onNavigate('appointments')}>
          <CalendarDays size={18} /> 查看我的约跑
        </button>
      </div>
    </div>
  )
}

/* =========================== Volunteer (志愿者) =========================== */

function VolunteerTraining({ user }: PageProps) {
  const toast = useToast()
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [nextStatus, nextCert] = await Promise.all([getTrainingStatus(), getCertificate()])
      setStatus(nextStatus)
      setCertificate(nextCert)
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

  // Refresh just the status/certificate without flipping the page into its
  // full-screen loading state (used after an action completes).
  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextCert] = await Promise.all([getTrainingStatus(), getCertificate()])
      setStatus(nextStatus)
      setCertificate(nextCert)
    } catch (err) {
      if (err instanceof CloudError) toast.error(err.message)
    }
  }, [toast])

  const markVideo = useCallback(async () => {
    if (marking) return
    setMarking(true)
    try {
      await markVideoWatched()
      toast.success('已记录视频观看，继续完成在线考核')
      await refresh()
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '操作失败，请稍后再试')
    } finally {
      setMarking(false)
    }
  }, [marking, refresh, toast])

  if (loading) {
    return <LoadingBlock label="正在加载培训进度…" />
  }

  if (error || !status) {
    return (
      <section className="card" style={{ textAlign: 'center' }}>
        <p className="empty__title">没能加载培训进度</p>
        <p className="empty__text" style={{ marginBottom: 16 }}>
          请检查网络连接后重试。
        </p>
        <button type="button" className="btn btn--accent btn--sm" onClick={() => void load()}>
          <RefreshCw size={16} /> 刷新重试
        </button>
      </section>
    )
  }

  const videoWatched = Boolean(status.videoWatched)
  const examPassed = status.examPassed === true
  const certified = examPassed && Boolean(status.certificateNo)

  const flags = [videoWatched, examPassed, certified]
  const pct = Math.round((flags.filter(Boolean).length / flags.length) * 100)

  return (
    <div className="stack stagger">
      {/* Progress overview */}
      <section className="card">
        <div className="row row--between">
          <span className="section-title" style={{ margin: 0 }}>
            <GraduationCap size={18} /> 培训进度
          </span>
          <span className="chip chip--pine">{pct}%</span>
        </div>
        <div className="progress" style={{ marginTop: 14 }}>
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="stack stack--sm" style={{ marginTop: 16 }}>
          <StepRow
            tint="var(--pine-tint)"
            color="var(--pine)"
            icon={<PlayCircle size={20} />}
            title="观看培训视频"
            meta="了解陪跑安全与引导技巧"
            done={videoWatched}
            doneLabel="已完成"
            pendingLabel="待完成"
          />
          <StepRow
            tint="var(--beacon-tint)"
            color="var(--beacon-deep)"
            icon={<GraduationCap size={20} />}
            title="在线考核"
            meta={examPassed ? `已通过 · ${status.examScore ?? 0} 分` : '通过后可获得认证'}
            done={examPassed}
            doneLabel="已通过"
            pendingLabel="待考核"
          />
          <StepRow
            tint="var(--sky-tint)"
            color="var(--sky)"
            icon={<Award size={20} />}
            title="陪跑认证证书"
            meta={certified ? `证书编号 ${status.certificateNo}` : '完成考核后自动签发'}
            done={certified}
            doneLabel="已认证"
            pendingLabel="未认证"
          />
        </div>
      </section>

      {/* Step 1 — watch the training video */}
      {!videoWatched && (
        <section className="card">
          <span className="section-title" style={{ margin: '0 0 12px' }}>
            <PlayCircle size={17} /> 第一步 · 观看培训视频
          </span>
          <p className="callout__text" style={{ marginBottom: 14 }}>
            请完整观看陪跑培训视频，了解引导手势、路线选择与突发情况处理，观看后点击下方按钮记录进度。
          </p>
          <button
            type="button"
            className="btn btn--pine btn--block"
            onClick={() => void markVideo()}
            disabled={marking}
          >
            {marking ? <Spinner /> : <CheckCircle2 size={18} />}
            {marking ? '记录中…' : '我已完整观看视频'}
          </button>
        </section>
      )}

      {/* Step 2 — the exam (only after the video, only until passed) */}
      {videoWatched && !examPassed && <ExamSection onPassed={refresh} />}

      {/* Step 3 — certificate + verification */}
      {certified && certificate && (
        <CertificatePanel certificate={certificate} fallbackName={user.name || user.nickName} />
      )}
    </div>
  )
}

/* -------------------------------- step row -------------------------------- */

function StepRow({
  tint,
  color,
  icon,
  title,
  meta,
  done,
  doneLabel,
  pendingLabel
}: {
  tint: string
  color: string
  icon: React.ReactNode
  title: string
  meta: string
  done: boolean
  doneLabel: string
  pendingLabel: string
}) {
  return (
    <div className="list-row" role="group" style={{ cursor: 'default' }}>
      <span className="callout__icon" style={{ background: tint, color }}>
        {icon}
      </span>
      <div className="list-row__body">
        <div className="list-row__title">{title}</div>
        <div className="list-row__meta">{meta}</div>
      </div>
      <span className={done ? 'chip chip--pine' : 'chip'}>{done ? doneLabel : pendingLabel}</span>
    </div>
  )
}

/* ---------------------------------- exam ---------------------------------- */

function ExamSection({ onPassed }: { onPassed: () => Promise<void> }) {
  const toast = useToast()
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null)
  const [passScore, setPassScore] = useState(80)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ExamResult | null>(null)

  const startExam = useCallback(async () => {
    if (loadingQuestions) return
    setLoadingQuestions(true)
    setResult(null)
    try {
      const { questions: qs, passScore: ps } = await getExamQuestions()
      const sorted = [...qs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setQuestions(sorted)
      setPassScore(ps)
      setAnswers({})
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '题目加载失败，请稍后再试')
    } finally {
      setLoadingQuestions(false)
    }
  }, [loadingQuestions, toast])

  const choose = useCallback((questionId: string, index: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: index }))
  }, [])

  const submit = useCallback(async () => {
    if (!questions || submitting) return
    const unanswered = questions.find((q) => answers[q._id] === undefined)
    if (unanswered) {
      toast.error('请回答全部题目后再提交')
      return
    }
    setSubmitting(true)
    try {
      const res = await submitExam(
        questions.map((q) => ({ questionId: q._id, selectedIndex: answers[q._id] }))
      )
      setResult(res)
      if (res.passed) {
        toast.success(`考核通过！得分 ${res.score} 分`)
        await onPassed()
      } else {
        toast.error(`未通过，得分 ${res.score} 分，可再试一次`)
      }
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }, [questions, submitting, answers, onPassed, toast])

  const retry = useCallback(() => {
    setResult(null)
    setAnswers({})
  }, [])

  // Not started yet — invite the volunteer to begin.
  if (!questions) {
    return (
      <section className="card">
        <span className="section-title" style={{ margin: '0 0 12px' }}>
          <GraduationCap size={17} /> 第二步 · 在线考核
        </span>
        <p className="callout__text" style={{ marginBottom: 14 }}>
          考核为单选题，全部作答后提交。达到通过分数即可自动获得陪跑认证证书。
        </p>
        <button
          type="button"
          className="btn btn--accent btn--block"
          onClick={() => void startExam()}
          disabled={loadingQuestions}
        >
          {loadingQuestions ? <Spinner /> : <GraduationCap size={18} />}
          {loadingQuestions ? '加载题目…' : '开始考核'}
        </button>
      </section>
    )
  }

  // Result view — score, pass/fail, and per-question correctness (no answers).
  if (result) {
    return (
      <section className="card">
        <div className="row row--between">
          <span className="section-title" style={{ margin: 0 }}>
            {result.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />} 考核结果
          </span>
          <span className={result.passed ? 'chip chip--pine' : 'chip chip--coral'}>
            {result.passed ? '已通过' : '未通过'}
          </span>
        </div>

        <div className="grid-2" style={{ marginTop: 14 }}>
          <div className="stat">
            <div className="stat__value">{result.score}</div>
            <div className="stat__label">得分（通过线 {passScore}）</div>
          </div>
          <div className="stat">
            <div className="stat__value">
              {result.correctCount}/{result.totalQuestions}
            </div>
            <div className="stat__label">答对题数</div>
          </div>
        </div>

        <hr className="divider" style={{ margin: '16px 0 12px' }} />

        <div className="stack stack--sm">
          {questions.map((q, i) => {
            const verdict = result.results.find((r) => r.questionId === q._id)
            const correct = verdict?.isCorrect === true
            return (
              <div key={q._id} className="list-row" role="group" style={{ cursor: 'default' }}>
                <div className="list-row__body">
                  <div className="list-row__title" style={{ whiteSpace: 'normal' }}>
                    {i + 1}. {q.question}
                  </div>
                </div>
                <span className={correct ? 'chip chip--pine' : 'chip chip--coral'}>
                  {correct ? (
                    <>
                      <CheckCircle2 size={14} /> 正确
                    </>
                  ) : (
                    <>
                      <XCircle size={14} /> 错误
                    </>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {!result.passed && (
          <button
            type="button"
            className="btn btn--accent btn--block"
            style={{ marginTop: 16 }}
            onClick={retry}
          >
            <RefreshCw size={18} /> 再考一次
          </button>
        )}
      </section>
    )
  }

  // Active exam — radio groups for each question.
  const answeredCount = questions.filter((q) => answers[q._id] !== undefined).length

  return (
    <section className="card">
      <div className="row row--between">
        <span className="section-title" style={{ margin: 0 }}>
          <GraduationCap size={17} /> 在线考核
        </span>
        <span className="chip">
          {answeredCount}/{questions.length}
        </span>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {questions.map((q, i) => (
          <fieldset key={q._id} className="exam-q">
            <legend className="exam-q__title">
              {i + 1}. {q.question}
            </legend>
            <div className="stack stack--sm" role="radiogroup" aria-label={`第 ${i + 1} 题`}>
              {q.options.map((opt, idx) => {
                const selected = answers[q._id] === idx
                return (
                  <label key={idx} className="exam-opt" data-selected={selected}>
                    <input
                      type="radio"
                      name={`q-${q._id}`}
                      checked={selected}
                      onChange={() => choose(q._id, idx)}
                    />
                    <span>{opt}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <button
        type="button"
        className="btn btn--accent btn--block"
        style={{ marginTop: 16 }}
        onClick={() => void submit()}
        disabled={submitting}
      >
        {submitting ? <Spinner /> : <Send size={18} />}
        {submitting ? '提交中…' : '提交答卷'}
      </button>
    </section>
  )
}

/* ------------------------------ certificate ------------------------------- */

function CertificatePanel({
  certificate,
  fallbackName
}: {
  certificate: Certificate
  fallbackName: string
}) {
  const toast = useToast()
  const [input, setInput] = useState(certificate.certificateNo || '')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState<{ valid: boolean; certificate?: Certificate } | null>(null)

  const verify = useCallback(async () => {
    const no = input.trim()
    if (!no) {
      toast.error('请输入要核验的证书编号')
      return
    }
    if (verifying) return
    setVerifying(true)
    setVerified(null)
    try {
      const res = await verifyCertificate(no)
      setVerified(res)
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '核验失败，请稍后再试')
    } finally {
      setVerifying(false)
    }
  }, [input, verifying, toast])

  return (
    <section className="card card--pop">
      <span className="section-title" style={{ margin: '0 0 14px' }}>
        <Award size={18} /> 陪跑认证证书
      </span>

      <div className="cert">
        <div className="cert__seal" aria-hidden>
          <ShieldCheck size={24} />
        </div>
        <div className="cert__name">{certificate.userName || fallbackName}</div>
        <p className="cert__sub">已通过助盲陪跑认证</p>

        <dl className="cert__grid">
          <div>
            <dt>证书编号</dt>
            <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{certificate.certificateNo}</dd>
          </div>
          <div>
            <dt>考核成绩</dt>
            <dd>{certificate.score} 分</dd>
          </div>
          <div>
            <dt>认证日期</dt>
            <dd>{formatDate(certificate.examDate)}</dd>
          </div>
        </dl>
      </div>

      <hr className="divider" style={{ margin: '16px 0 14px' }} />

      <div className="field">
        <label className="field__label" htmlFor="cert-verify">
          <Search size={14} /> 证书核验
        </label>
        <div className="input-group">
          <input
            id="cert-verify"
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入证书编号核验真伪"
            autoComplete="off"
          />
        </div>
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--block"
        style={{ marginTop: 10, border: '1.5px solid var(--line)' }}
        onClick={() => void verify()}
        disabled={verifying}
      >
        {verifying ? <Spinner /> : <ShieldCheck size={18} />}
        {verifying ? '核验中…' : '核验证书'}
      </button>

      {verified &&
        (verified.valid && verified.certificate ? (
          <div className="callout callout--pine" style={{ marginTop: 12 }}>
            <div className="callout__icon">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="callout__title">证书有效</p>
              <p className="callout__text">
                {verified.certificate.userName} · {verified.certificate.score} 分 ·{' '}
                {formatDate(verified.certificate.examDate)}
              </p>
            </div>
          </div>
        ) : (
          <div className="callout callout--coral" style={{ marginTop: 12 }}>
            <div className="callout__icon">
              <XCircle size={20} />
            </div>
            <div>
              <p className="callout__title">证书无效</p>
              <p className="callout__text">未找到该编号对应的有效证书，请核对后重试。</p>
            </div>
          </div>
        ))}
    </section>
  )
}

/* -------------------------------- helpers --------------------------------- */

/** Render an ISO-ish date string as YYYY-MM-DD; falls back to the raw value. */
function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value
}
