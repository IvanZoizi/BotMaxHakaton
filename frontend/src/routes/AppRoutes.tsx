import { Navigate, Route, Routes } from 'react-router-dom';
import { usePersona } from '../context/AuthContext';
import { maxBridge } from '../bridge/maxBridge';
import { parseDeepLink } from '../lib/deepLink';
import { RoleGate } from './RoleGate';

import Connect from '../pages/employee/Connect';
import Home from '../pages/employee/Home';
import NewRequest from '../pages/employee/NewRequest';
import MyRequest from '../pages/employee/MyRequest';
import MyDocuments from '../pages/employee/MyDocuments';
import DocumentDetail from '../pages/employee/DocumentDetail';
import Signing from '../pages/employee/Signing';
import TeamCalendar from '../pages/employee/TeamCalendar';
import Availability from '../pages/employee/Availability';
import ShiftOfferScreen from '../pages/employee/ShiftOfferScreen';
import ScheduleT7Submit from '../pages/employee/ScheduleT7';

import Inbox from '../pages/manager/Inbox';
import Approval from '../pages/manager/Approval';
import Team from '../pages/manager/Team';
import Substitution from '../pages/manager/Substitution';
import ScheduleT7Review from '../pages/manager/ScheduleT7';

import Registry from '../pages/accountant/Registry';
import Deadlines from '../pages/accountant/Deadlines';
import ReviewQueue from '../pages/accountant/ReviewQueue';
import AuditJournal from '../pages/accountant/AuditJournal';

import CompanyConnect from '../pages/admin/CompanyConnect';
import Employees from '../pages/admin/Employees';
import Settings from '../pages/admin/Settings';
import SettingsRules from '../pages/admin/SettingsRules';

const ROLE_HOME: Record<string, string> = {
  employee: '/employee/home',
  manager: '/manager/inbox',
  accountant: '/accountant/registry',
  admin: '/admin/employees',
};

/** №39: карточка согласования в MAX шлёт OpenAppButton с payload
 * requestId=<id> — раньше мини-апп полностью его игнорировал и всегда
 * открывал домашний экран роли. Та же логика открывает off_<id> (карточка
 * подработки) и t7_<год> (форма графика Т-7). */
function deepLinkRedirect(role: string): string | null {
  const link = parseDeepLink(maxBridge.startParam);
  if (!link) return null;
  if (link.kind === 'leaveRequest') {
    return role === 'manager' ? `/manager/requests/${link.requestId}` : `/employee/requests/${link.requestId}`;
  }
  if (link.kind === 'shiftOffer') {
    return `/employee/shift-offers/${link.offerId}`;
  }
  if (link.kind === 'scheduleT7') {
    return role === 'manager' ? `/manager/schedule-t7/${link.year}` : `/employee/schedule-t7/${link.year}`;
  }
  return null;
}

function RootRedirect() {
  const persona = usePersona();
  if (!persona.isLinked) return <Navigate to="/connect" replace />;
  const deepLink = deepLinkRedirect(persona.role);
  return <Navigate to={deepLink ?? ROLE_HOME[persona.role]} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/connect" element={<Connect />} />
      {/* Мультитенантность (§1a): создание компании с нуля — пользователь
          ещё ни к чему не привязан, поэтому без RoleGate. */}
      <Route path="/company/new" element={<CompanyConnect />} />

      {/* Employee */}
      <Route path="/employee/home" element={<RoleGate role="employee"><Home /></RoleGate>} />
      <Route path="/employee/new-request" element={<RoleGate role="employee"><NewRequest /></RoleGate>} />
      <Route path="/employee/requests/:id" element={<RoleGate role="employee"><MyRequest /></RoleGate>} />
      <Route path="/employee/documents" element={<RoleGate role="employee"><MyDocuments /></RoleGate>} />
      <Route path="/employee/documents/:id" element={<RoleGate role="employee"><DocumentDetail /></RoleGate>} />
      <Route path="/employee/documents/:id/sign" element={<RoleGate role="employee"><Signing /></RoleGate>} />
      <Route path="/employee/team-calendar" element={<RoleGate role="employee"><TeamCalendar /></RoleGate>} />
      <Route path="/employee/availability" element={<RoleGate role="employee"><Availability /></RoleGate>} />
      <Route path="/employee/shift-offers/:id" element={<RoleGate role="employee"><ShiftOfferScreen /></RoleGate>} />
      <Route path="/employee/schedule-t7/:year" element={<RoleGate role="employee"><ScheduleT7Submit /></RoleGate>} />

      {/* Manager */}
      <Route path="/manager/inbox" element={<RoleGate role="manager"><Inbox /></RoleGate>} />
      <Route path="/manager/requests/:id" element={<RoleGate role="manager"><Approval /></RoleGate>} />
      <Route path="/manager/team" element={<RoleGate role="manager"><Team /></RoleGate>} />
      <Route path="/manager/shifts/:shiftId/candidates" element={<RoleGate role="manager"><Substitution /></RoleGate>} />
      <Route path="/manager/schedule-t7/:year" element={<RoleGate role="manager"><ScheduleT7Review /></RoleGate>} />
      <Route path="/manager/documents/:id/sign" element={<RoleGate role="manager"><Signing /></RoleGate>} />

      {/* Accountant */}
      <Route path="/accountant/registry" element={<RoleGate role="accountant"><Registry /></RoleGate>} />
      <Route path="/accountant/documents/:id" element={<RoleGate role="accountant"><DocumentDetail /></RoleGate>} />
      <Route path="/accountant/deadlines" element={<RoleGate role="accountant"><Deadlines /></RoleGate>} />
      <Route path="/accountant/review-queue" element={<RoleGate role="accountant"><ReviewQueue /></RoleGate>} />
      <Route path="/accountant/audit" element={<RoleGate role="accountant"><AuditJournal /></RoleGate>} />

      {/* Admin */}
      {/* Без RoleGate намеренно: /company/new ведёт сюда же для ещё не
          привязанного пользователя (шаги 2-3 мастера), а не только для
          существующего admin, который решил добавить точку/сотрудника позже. */}
      <Route path="/admin/connect" element={<CompanyConnect />} />
      <Route path="/admin/employees" element={<RoleGate role="admin"><Employees /></RoleGate>} />
      <Route path="/admin/settings" element={<RoleGate role="admin"><Settings /></RoleGate>} />
      <Route path="/admin/settings/rules" element={<RoleGate role="admin"><SettingsRules /></RoleGate>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
