import { CODEBOOK } from "../core/codebook.js";

// Every key with its codebook definition.
export default function HelpOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-auto bg-ink/50 py-10" onClick={onClose}>
      <div className="w-[min(900px,94vw)] rounded bg-paper p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Touches · codebook v{CODEBOOK.version}</h2><button className="btn" onClick={onClose}>Fermer (Échap)</button></div>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {CODEBOOK.keys.match.map((k) => (
              <tr key={k.key} className="border-t border-rule align-top">
                <td className="py-1.5 pr-3"><kbd>{k.key}</kbd></td>
                <td className="py-1.5 pr-3 font-medium">{k.label_fr}</td>
                <td className="py-1.5 text-ink-2">{k.definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-6 label">Confort</h3>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {CODEBOOK.keys.comfort.map((k) => (
              <tr key={k.keys.join()} className="border-t border-rule">
                <td className="py-1.5 pr-3">{k.keys.map((x) => <kbd key={x} className="mr-1">{x}</kbd>)}</td>
                <td className="py-1.5 text-ink-2">{k.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
