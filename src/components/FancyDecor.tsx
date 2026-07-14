// ファンシーモード専用の星屑装飾レイヤー。
// 見た目はすべて index.css の [data-theme="fancy"] スコープで定義する。
// light/dark では App 側で条件マウントされないため DOM に存在しない。
export function FancyDecor() {
  const sparkles: { top: string; left?: string; right?: string; size: string; delay: string }[] = [
    { top: '8%', left: '4%', size: '1.4rem', delay: '0s' },
    { top: '22%', left: '2%', size: '1rem', delay: '1.1s' },
    { top: '40%', left: '5%', size: '1.2rem', delay: '0.6s' },
    { top: '58%', left: '3%', size: '0.9rem', delay: '1.8s' },
    { top: '76%', left: '6%', size: '1.3rem', delay: '0.3s' },
    { top: '12%', right: '5%', size: '1.2rem', delay: '0.9s' },
    { top: '30%', right: '3%', size: '1rem', delay: '2.1s' },
    { top: '50%', right: '6%', size: '1.4rem', delay: '0.4s' },
    { top: '68%', right: '2%', size: '0.9rem', delay: '1.5s' },
    { top: '86%', right: '5%', size: '1.2rem', delay: '1s' },
  ]

  return (
    <>
      <div className="fancy-stardust" aria-hidden="true" />
      <div className="fancy-sparkles" aria-hidden="true">
        {sparkles.map((s, i) => (
          <span
            key={i}
            style={{
              top: s.top,
              left: s.left,
              right: s.right,
              fontSize: s.size,
              animationDelay: s.delay,
            }}
          >
            ✦
          </span>
        ))}
      </div>
    </>
  )
}
