import { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "./Icon";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Evita tela em branco quando algum item com dados inesperados quebra a
 * renderização. Os dados continuam salvos no navegador.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Erro ao renderizar o Entretempo:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error">
          <div className="fatal-error-card">
            <span className="fatal-error-icon">
              <Icon name="info" size={22} />
            </span>
            <h1>Algo deu errado nesta tela</h1>
            <p>
              Seus itens continuam salvos neste navegador. Recarregue para voltar à lista; se o
              problema persistir, exporte um backup em <strong>Dados</strong>.
            </p>
            <div className="fatal-error-actions">
              <button type="button" className="primary-button" onClick={() => location.reload()}>
                Recarregar
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  this.setState({ error: null });
                  location.hash = "";
                }}
              >
                Tentar novamente
              </button>
            </div>
            <details>
              <summary>Detalhes técnicos</summary>
              <pre>{this.state.error.message}</pre>
            </details>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
