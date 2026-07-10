export default function ProtectedLoading() {
  return (
    <div role="status" aria-label="页面加载中" className="space-y-6 animate-pulse">
      <div className="h-16 rounded-md border border-border-base bg-bg-panel/70" />
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-slate-700/70" />
        <div className="h-8 w-64 max-w-full rounded bg-slate-700/70" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-52 rounded-md border border-border-base bg-bg-panel/70" />
        <div className="h-52 rounded-md border border-border-base bg-bg-panel/70" />
        <div className="h-52 rounded-md border border-border-base bg-bg-panel/70" />
      </div>
      <span className="sr-only">正在加载页面内容</span>
    </div>
  );
}
