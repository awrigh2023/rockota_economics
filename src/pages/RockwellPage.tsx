import { useAuth } from '../context/AuthContext';
import WorkspaceShell from '../components/rockwell/WorkspaceShell';

/**
 * Rockwell page — the vault workspace.
 *
 * Two tabs (Vault | Graph) with a persistent search bar, and the file tree
 * visible in both. Auth behaviour is enforced server-side:
 *   - Unauthenticated: public notes only (tree, graph, and search), read-only.
 *   - Authenticated: public + private notes, editable, full search scope.
 *
 * Chat was removed from this page (2026-07) — the page is now purely the
 * vault + graph + search experience.
 */
export default function RockwellPage() {
  const { token } = useAuth();

  return (
    <div
      className="flex flex-col bg-rw-background relative"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      <WorkspaceShell token={token} />
    </div>
  );
}
