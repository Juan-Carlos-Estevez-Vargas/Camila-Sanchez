import type { Messages } from "@/i18n";

export const common: Messages["common"] = {
  loading: "Carregando",
  loadingEllipsis: "Carregando…",
  close: "Fechar",
  cancel: "Cancelar",
  confirm: "Confirmar",
  save: "Salvar",
  saving: "Salvando…",
  delete: "Excluir",
  edit: "Editar",
  back: "Voltar",
  view: "Ver",
  reload: "Recarregar",
  oops: "Ops",
  someone: "Alguém",
  newBadge: "Nova: ",
  opensNewTab: "(abre em outra aba)",
  closeToast: (title) => `Fechar aviso: ${title}`,
  somethingNew: "Você tem algo novo",
  errorBoundary: "Algo quebrou nesta parte",
};
