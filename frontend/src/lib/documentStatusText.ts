import type { DocumentStatus } from '../api/types';

/**
 * Document Card's canonical subtitle status text ("от {дата} · {статус}",
 * Figma page 02 — Components → Documents). First-person ("ждём вашу
 * подпись") for the owner's own document list (My Documents); third-person
 * with the owner's name ("ждём подпись Петровой М. А.") for someone else
 * viewing it (Registry) — both forms are attested in Figma.
 */
export function documentStatusText(status: DocumentStatus, ownerName?: string): string {
  switch (status) {
    case 'formed':
      return 'сформирован';
    case 'to_sign':
      return ownerName ? `ждём подпись ${ownerName}` : 'ждём вашу подпись';
    case 'signed':
      return 'подписан';
    case 'in_accounting':
      return 'передан в бухгалтерию';
    case 'archived':
      return 'в архиве';
    case 'annulled':
      return 'аннулирован';
  }
}
