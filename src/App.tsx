import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Item, NewItemInput, Status, ToastState } from "./types";
import { STATUS_META, TYPE_META } from "./lib/catalog";
import {
  clearSupabase,
  createItem,
  loadFromSupabase,
  seedItems,
  syncToSupabase,
} from "./lib/storage";
import { getSession, onAuthChange, signOut } from "./lib/auth";
import { formatCompact, itemDuration, normalizeTitle } from "./lib/time";
import { AddItemModal } from "./components/AddItemModal";
import { CoverPicker } from "./components/CoverPicker";
import { DataModal } from "./components/DataModal";
import { Icon } from "./components/Icon";
import { ItemCard } from "./components/ItemCard";
import { LoginScreen } from "./components/LoginScreen";
import { Toast } from "./components/Toast";

const TABS: Status[] = ["current", "finished", "discarded"];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="30" height="30">
        <defs>
          <linearGradient id="brand-gradient" x1="4" y1="4" x2="28" y2="28">
            <stop stopColor="#c3b8ff" />
            <stop offset="1" stopColor="#6f5ee0" />
          </linearGradient>
        </defs>
        <circle
          cx="16"
          cy="16"
          r="10"
          fill="none"
          stroke="url(#brand-gradient)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeDasharray="47 16"
          transform="rotate(-38 16 16)"
        />
        <path d="M14.2 11.6 21 16l-6.8 4.4V11.6Z" fill="url(#brand-gradient)" />
        <circle cx="16" cy="16" r="1.9" fill="#0a0a0c" />
      </svg>
    </span>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Status>("current");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [coverItemId, setCoverItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showSampleNote, setShowSampleNote] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  const userId = session?.user.id ?? null;

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sessão do Supabase Auth (persistida pelo próprio cliente).
  useEffect(() => {
    let active = true;

    getSession()
      .then((current) => {
        if (active) setSession(current);
      })
      .catch(() => {
        if (active) setSession(null);
      });

    const unsubscribe = onAuthChange((next) => setSession(next));

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Carrega os itens do usuário autenticado (ou usa exemplos na primeira vez).
  useEffect(() => {
    if (!userId) {
      setItems([]);
      setItemsLoading(false);
      return;
    }

    let cancelled = false;
    setItemsLoading(true);

    loadFromSupabase(userId)
      .then((cloud) => {
        if (cancelled) return;
        setItems(cloud.length > 0 ? cloud : seedItems());
        setItemsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems(seedItems());
        setItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Sincroniza alterações com o Supabase (debounce para evitar excesso).
  useEffect(() => {
    if (!userId || itemsLoading) return;

    const timer = window.setTimeout(() => {
      void syncToSupabase(items, userId);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [items, userId, itemsLoading]);

  useEffect(() => {
    if (!highlightId) return;
    const element = document.getElementById(`item-${highlightId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");

      if (typing) return;

      if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !addOpen &&
        !dataOpen
      ) {
        event.preventDefault();
        setAddOpen(true);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [addOpen, dataOpen]);

  const visibleItems = useMemo(() => {
    const query = normalizeTitle(search);

    return items
      .filter((item) => item.status === activeTab)
      .filter((item) => !query || normalizeTitle(item.title).includes(query))
      .sort((first, second) => first.order - second.order || first.createdAt - second.createdAt);
  }, [items, activeTab, search]);

  const counts = useMemo(() => {
    return TABS.reduce(
      (accumulator, status) => {
        accumulator[status] = items.filter((item) => item.status === status).length;
        return accumulator;
      },
      { current: 0, finished: 0, discarded: 0 } as Record<Status, number>,
    );
  }, [items]);

  const currentItems = useMemo(
    () => items.filter((item) => item.status === "current"),
    [items],
  );

  const currentMinutes = useMemo(
    () => currentItems.reduce((total, item) => total + (itemDuration(item) ?? 0), 0),
    [currentItems],
  );

  const inProgressItems = currentItems.filter((item) => item.inProgress);
  const coverItem = coverItemId ? items.find((item) => item.id === coverItemId) ?? null : null;
  const dragDisabled = search.trim().length > 0;
  const activeMeta = STATUS_META[activeTab];

  function notify(
    message: string,
    options?: { tone?: "default" | "danger"; action?: ToastState["action"]; duration?: number },
  ) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({
      id: Date.now(),
      message,
      tone: options?.tone,
      action: options?.action,
    });

    toastTimer.current = window.setTimeout(
      () => setToast(null),
      options?.duration ?? (options?.action ? 6500 : 3200),
    );
  }

  function nextOrder(status: Status): number {
    return (
      Math.max(
        -1,
        ...items.filter((item) => item.status === status).map((item) => item.order),
      ) + 1
    );
  }

  function patchItem(id: string, patch: Partial<Item>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item,
      ),
    );
  }

  function addItem(input: NewItemInput) {
    const item = createItem(input, nextOrder("current"));
    setItems((current) => [...current, item]);
    setSearch("");
    setActiveTab("current");
    setExpandedId(null);
    setAddOpen(false);
    setHighlightId(item.id);
    notify(`${item.title} entrou na sua lista.`, {
      action: {
        label: "Desfazer",
        run: () => {
          setItems((current) => current.filter((entry) => entry.id !== item.id));
          setHighlightId(null);
        },
      },
    });
  }

  function toggleProgress(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current || current.status !== "current") return;

    patchItem(id, { inProgress: !current.inProgress });
    notify(
      current.inProgress
        ? `${current.title} saiu de “em andamento”.`
        : `${current.title} está em andamento.`,
    );
  }

  function moveItem(id: string, status: Status) {
    const previous = items.find((item) => item.id === id);
    if (!previous || previous.status === status) return;

    const order = nextOrder(status);
    const now = Date.now();

    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              order,
              inProgress: false,
              finishedAt: status === "finished" ? now : null,
              discardedAt: status === "discarded" ? now : null,
              updatedAt: now,
            }
          : item,
      ),
    );

    if (expandedId === id) setExpandedId(null);

    const message =
      status === "finished"
        ? `${previous.title} foi finalizado.`
        : status === "discarded"
          ? `${previous.title} foi descartado.`
          : `${previous.title} voltou para Agora.`;

    notify(message, {
      action: {
        label: "Desfazer",
        run: () =>
          setItems((current) =>
            current.map((item) => (item.id === id ? previous : item)),
          ),
      },
    });
  }

  function deleteItem(id: string) {
    const previous = items.find((item) => item.id === id);
    if (!previous) return;

    setItems((current) => current.filter((item) => item.id !== id));
    if (expandedId === id) setExpandedId(null);
    if (coverItemId === id) setCoverItemId(null);

    notify(`${previous.title} foi excluído.`, {
      tone: "danger",
      action: {
        label: "Desfazer",
        run: () => setItems((current) => [...current, previous]),
      },
    });
  }

  function clearSamples() {
    setItems((current) => current.filter((item) => !item.sample));
    setShowSampleNote(false);
    setExpandedId(null);
    notify("Itens de exemplo removidos. A lista é toda sua.");
  }

  function clearAll() {
    setItems([]);
    setExpandedId(null);
    setCoverItemId(null);
    setShowSampleNote(false);
    if (userId) void clearSupabase(userId);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || dragDisabled) return;

    const oldIndex = visibleItems.findIndex((item) => item.id === active.id);
    const newIndex = visibleItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(visibleItems, oldIndex, newIndex);
    const orderMap = new Map(reordered.map((item, index) => [item.id, index]));

    setItems((current) =>
      current.map((item) =>
        orderMap.has(item.id)
          ? { ...item, order: orderMap.get(item.id) ?? item.order }
          : item,
      ),
    );
  }

  const sampleCount = items.filter((item) => item.sample).length;
  const firstInProgress = inProgressItems[0];

  if (session === undefined) {
    return (
      <div className="auth-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="grain" />
        <div className="auth-card is-loading">
          <span className="spinner" />
          <p>Verificando sua sessão…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grain" />

      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="Entretempo — início"
        >
          <BrandMark />
          <span className="brand-word">entretempo</span>
        </a>

        <div className="header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setDataOpen(true)}
            title="Backup e armazenamento"
          >
            <Icon name="database" size={16} />
            <span>Dados</span>
          </button>
          <button type="button" className="primary-button" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={17} />
            <span>Adicionar item</span>
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void signOut()}
            title={session.user.email ? `Sair de ${session.user.email}` : "Sair da conta"}
          >
            <Icon name="logout" size={16} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Sua fila pessoal</p>
            <h1>
              O que vem
              <br />
              a seguir?
            </h1>
            <p className="subtitle">
              Jogos, filmes e séries esperando por você — na ordem certa.
            </p>
            {firstInProgress ? (
              <p className="now-line">
                <span className="pulse-dot" />
                <span>Em andamento:</span>
                <strong>{firstInProgress.title}</strong>
                {inProgressItems.length > 1 ? (
                  <span className="now-more">+{inProgressItems.length - 1}</span>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{counts.current}</span>
              <span className="stat-label">
                {counts.current === 1 ? "item na fila" : "itens na fila"}
              </span>
            </div>
            <span className="stat-divider" />
            <div className="stat">
              <span className="stat-value accent">
                {currentMinutes > 0 ? `≈ ${formatCompact(currentMinutes)}` : "—"}
              </span>
              <span className="stat-label">para colocar em dia</span>
            </div>
            <span className="stat-line" />
          </div>
        </section>

        <section className="list-section">
          <div className="tabs-row">
            <nav className="tabs" aria-label="Status da lista">
              {TABS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={activeTab === status ? "tab is-active" : "tab"}
                  aria-pressed={activeTab === status}
                  onClick={() => {
                    setActiveTab(status);
                    setExpandedId(null);
                  }}
                >
                  {STATUS_META[status].label}
                  <span>{counts[status]}</span>
                </button>
              ))}
            </nav>

            <label className="search-field">
              <Icon name="search" size={17} />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar na lista..."
                aria-label="Buscar na lista"
                spellCheck={false}
              />
              {search ? (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                >
                  <Icon name="close" size={13} />
                </button>
              ) : (
                <kbd>{isMac ? "⌘ K" : "Ctrl K"}</kbd>
              )}
            </label>
          </div>

          <div className="list-heading">
            <div>
              <h2>{activeMeta.label}</h2>
              <p>{activeMeta.description}</p>
            </div>
            <div className="list-tools">
              {inProgressItems.length > 0 && activeTab === "current" ? (
                <span className="progress-count">
                  <span className="pulse-dot" />
                  {inProgressItems.length} em andamento
                </span>
              ) : null}
              <span className={dragDisabled ? "drag-hint is-disabled" : "drag-hint"}>
                <Icon name="grip" size={14} />
                {dragDisabled ? "Limpe a busca para reordenar" : "Arraste para ordenar"}
              </span>
            </div>
          </div>

          {showSampleNote && sampleCount > 0 ? (
            <div className="sample-note">
              <span className="sample-note-icon">
                <Icon name="sparkle" size={16} />
              </span>
              <p>
                Estes são <strong>itens de exemplo</strong> para você sentir a lista. Edite,
                arraste ou comece do zero.
              </p>
              <button type="button" className="text-button" onClick={clearSamples}>
                Começar do zero
              </button>
              <button
                type="button"
                className="icon-button small"
                onClick={() => setShowSampleNote(false)}
                aria-label="Ocultar aviso de exemplos"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ) : null}

          {visibleItems.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={visibleItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="item-list">
                  {visibleItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      dragDisabled={dragDisabled}
                      highlighted={highlightId === item.id}
                      onToggleExpand={() =>
                        setExpandedId((current) => (current === item.id ? null : item.id))
                      }
                      onPatch={(patch) => patchItem(item.id, patch)}
                      onOpenCover={() => setCoverItemId(item.id)}
                      onMove={(status) => moveItem(item.id, status)}
                      onDelete={() => deleteItem(item.id)}
                      onToggleProgress={() => toggleProgress(item.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name={search ? "search" : TYPE_META.game.icon} size={24} />
              </span>
              <h3>{search ? "Nenhum item encontrado" : activeMeta.emptyTitle}</h3>
              <p>
                {search
                  ? `Nada na lista combina com “${search.trim()}”.`
                  : activeMeta.emptyCopy}
              </p>
              {search ? (
                <button type="button" className="text-button" onClick={() => setSearch("")}>
                  <Icon name="arrowLeft" size={15} />
                  Limpar busca
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={() => setAddOpen(true)}>
                  <Icon name="plus" size={16} />
                  Adicionar primeiro item
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <span>entretempo — seu tempo, bem gasto.</span>
        <button type="button" className="footer-link" onClick={() => setDataOpen(true)}>
          <Icon name="database" size={13} />
          Backup e dados
        </button>
      </footer>

      {addOpen ? (
        <AddItemModal onClose={() => setAddOpen(false)} onAdd={addItem} />
      ) : null}

      {dataOpen ? (
        <DataModal
          items={items}
          onImport={(imported) => {
            setItems(imported);
            setExpandedId(null);
            setShowSampleNote(false);
            notify(`${imported.length} itens importados.`);
          }}
          onClear={clearAll}
          onClose={() => setDataOpen(false)}
        />
      ) : null}

      {coverItem ? (
        <CoverPicker
          type={coverItem.type}
          initialQuery={coverItem.title}
          currentCover={coverItem.coverUrl}
          onSelect={(coverUrl, source) =>
            patchItem(coverItem.id, { coverUrl, coverSource: source })
          }
          onClose={() => setCoverItemId(null)}
        />
      ) : null}

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
