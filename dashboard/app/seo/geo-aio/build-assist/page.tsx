export default function GeoBuildAssistPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">GEO Build-Assist</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          AI-gestuurde hulp bij het opbouwen van GEO-geoptimaliseerde content.
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">🚧</span>
        <p className="text-base font-semibold text-gray-900 dark:text-white">Binnenkort beschikbaar</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          De Build-Assist module wordt in een volgende sprint gebouwd.
        </p>
      </div>
    </div>
  );
}
