// The loading screen in index.html: shown while the code downloads, moved
// along as each stage finishes, and faded out once the first room has drawn.

function boot() {
  return typeof document === 'undefined' ? null : document.getElementById('boot')
}

/** Shows how far loading has got: a line saying what's happening and how full the bar is (0 to 1). */
export function bootStep(text: string, progress: number) {
  const el = boot()
  if (!el) return
  const step = el.querySelector('.boot-step')
  const fill = el.querySelector<HTMLElement>('.boot-fill')
  if (step) step.textContent = text
  if (fill) fill.style.width = `${Math.round(progress * 100)}%`
}

/** The first room is on screen: fill the bar and fade the loading screen away. */
export function bootDone() {
  const el = boot()
  if (!el || el.classList.contains('boot-done')) return
  bootStep('Ready', 1)
  el.classList.add('boot-done')
  setTimeout(() => el.remove(), 800)
}

// Never leave someone staring at the loading screen if the first room is slow to say it's ready.
if (typeof window !== 'undefined') setTimeout(bootDone, 20_000)
