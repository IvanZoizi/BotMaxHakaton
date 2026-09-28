/** "Кузнецов Артём Павлович" → "Кузнецов А. П." (surname + initials). */
export function surnameWithInitials(fullName: string): string {
  const [surname, first, patronymic] = fullName.trim().split(/\s+/);
  const parts = [surname];
  if (first) parts.push(`${first[0]}.`);
  if (patronymic) parts.push(`${patronymic[0]}.`);
  return parts.join(' ');
}
