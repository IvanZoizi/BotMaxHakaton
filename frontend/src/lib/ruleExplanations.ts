import type { CheckResult } from '../api/types';

/**
 * Full legal-explanation text for the BottomSheet/Rule sheet (Figma page 02
 * — Components → "Bottom Sheets"). `CheckResult.message` is only the short
 * pass/fail summary shown inline on the Check Row ("Срок извещения
 * соблюдён…") — the sheet needs the actual norm text ("О времени начала
 * отпуска работник должен быть извещён под роспись…"), which the contract's
 * `Rule`/`CheckResult` schemas don't carry as a separate field. Kept here as
 * presentation-only copy, keyed by ruleId.
 */
const EXPLANATIONS: Record<string, string> = {
  'tk.115.balance':
    'Остаток дней отпуска рассчитывается исходя из 2,33 дня, начисляемых за каждый полный отработанный месяц, плюс неиспользованные дни за прошлые периоды.',
  'tk.123.notice':
    'О времени начала отпуска работник должен быть извещён под роспись не позднее чем за две недели до его начала.',
  'tk.125.min-part-14':
    'Хотя бы одна часть ежегодного оплачиваемого отпуска должна быть не менее 14 календарных дней.',
  'tk.120.holidays':
    'Нерабочие праздничные дни, приходящиеся на период отпуска, не включаются в число календарных дней отпуска и не оплачиваются как отпускные.',
  'tk.124.two-years':
    'Запрещается непредоставление ежегодного оплачиваемого отпуска в течение двух лет подряд.',
  'company.team-overlap':
    'Внутреннее правило компании: пересечение отпусков сотрудников одной роли или смены не блокирует заявку, но требует внимания руководителя при согласовании.',
};

export function getRuleExplanation(check: CheckResult): string {
  const base = EXPLANATIONS[check.ruleId] ?? check.message;
  return `${base} Актуально на ${isoDate(check.checkedAt)}.`;
}

function isoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
