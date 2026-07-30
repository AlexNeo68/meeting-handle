---
name: prd
description: Создаю профессиональный PRD (Product Requirements Document) для новой фичи. Использовать когда пользователь просит «напиши PRD», «составь требования», «опиши фичу», «сделай спецификацию», «документацию на фичу», или явно упоминает документ требований к продукту. Содержит полный цикл: исследование контекста → интервью с пользователем → генерация PRD → сохранение в docs/prd/.
---

# PRD — Product Requirements Document

Профессиональный PRD описывает **что** и **зачем** мы делаем, оставляя **как** команде разработки. Документ живёт в `docs/prd/` и служит единым источником истины (SSOT) для всей команды.

## 1. Research

Перед тем как писать PRD, исследуй существующую кодовую базу и продукт:

1. Изучи структуру проекта (`apps/web`, `apps/api`, общие пакеты).
2. Найди существующие PRD в `docs/prd/` — используй их формат как шаблон и precedent.
3. Если фича затрагивает UI — изучи существующие компоненты в `apps/web/src/`.
4. Если фича затрагивает API — изучи существующие модули в `apps/api/src/`.
5. Проверь `schema.prisma` или другие файлы схемы БД для понимания моделей.
6. Изучи существующие тесты для понимания паттернов тестирования.
7. Найди relevant скиллы проекта (ui-ux-pro-max, nestjs-best-practices, vercel-react-best-practices) и загрузи их, если фича касается соответствующих областей.

## 2. Interview

Задай пользователю уточняющие вопросы, если контекста недостаточно. **Не добавляй вопросы, на которые уже есть ответы из контекста.** Минимум необходимых вопросов:

- **Проблема:** Какая конкретная проблема решается? Для кого?
- **Ожидания:** Какие key results или success metrics?
- **Границы:** Что точно НЕ входит в фичу? (non-goals)
- **Технические ограничения:** Есть ли известные ограничения (бюджет, время, совместимость)?

Если контекст из обсуждения уже даёт ответы — не спрашивай, используй их.

Перед интервью кратко (1–2 предложения) резюмируй своё понимание фичи, чтобы подтвердить alignment.

## 3. PRD Template

Используй следующий шаблон. Сохраняй файл как `docs/prd/prd-{feature-name}.md`, где `{feature-name}` — kebab-case на английском.

Удали секции, которые нерелевантны для данной фичи. Для простых фич можно объединять секции.

```markdown
# PRD: {Feature Name}

> **Статус:** Draft / Review / Approved
> **Автор:** {author}
> **Дата:** {YYYY-MM-DD}

---

## 1. Executive Summary

Краткое описание (2–4 предложения): что делаем, для кого, зачем.

## 2. Problem Statement

- **Текущая ситуация:** что есть сейчас и почему это не подходит
- **Боли пользователя:** конкретные сценарии, где текущее решение fails
- **Возможность:** какая открывается возможность (метрика, рынок, удовлетворённость)

## 3. Goals & Non-Goals

### Goals

- G1: {измеримая цель}
- G2: {измеримая цель}

### Non-Goals

- NG1: {что намеренно НЕ делаем в этой фиче}
- NG2: {что будет в следующих итерациях}

## 4. User Personas

| Персона | Роль | Потребности |
|---------|------|-------------|
| {name} | {role} | {needs} |

## 5. User Stories

Приоритет: P0 — must have, P1 — should have, P2 — nice to have.

1. **P0** As a {persona}, I want to {action}, so that {benefit}.
2. **P1** As a {persona}, I want to {action}, so that {benefit}.

## 6. Functional Requirements

Группируй по пользовательским историям или модулям. Используй FR-{N} нумерацию.

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-1 | {описание требования} | P0 | US-1 |
| FR-2 | {описание требования} | P1 | US-2 |

## 7. Non-Functional Requirements

| ID | Requirement | Category | Target |
|----|-------------|----------|--------|
| NFR-1 | {описание} | Performance | {критерий} |
| NFR-2 | {описание} | Security | {критерий} |
| NFR-3 | {описание} | UX/Accessibility | {критерий} |
| NFR-4 | {описание} | Reliability | {критерий} |

## 8. UI/UX Design

- **Screens / States:** перечисли ключевые экраны и их состояния (loading, empty, error, success)
- **Layout:** ссылка на макеты или текстовое описание расположения элементов
- **Accessibility considerations:** клавиатурная навигация, screen reader, контраст
- **Mobile responsiveness:** как адаптируется на мобильных устройствах
- **Loading states:** skeleton / spinner для каждого асинхронного экрана
- **Error states:** сообщения об ошибках рядом с элементом, не только вверху страницы
- **Empty states:** что видит пользователь, когда данных нет

## 9. Data Model / Schema Changes

```prisma
// если есть изменения в схеме БД
```

Или опиши новые / изменённые модели и поля текстом.

## 10. API Contracts

| Method | Endpoint | Request | Response | Notes |
|--------|----------|---------|----------|-------|
| GET | /api/v1/... | {params} | {response} | {notes} |

## 11. Implementation Notes

- **Modules to create/modify:** {list}
- **Key architectural decisions:** {list с обоснованием}
- **Dependencies:** {внутренние и внешние зависимости}
- **Migration plan:** {если нужна миграция данных}
- **Feature flags:** {нужен ли флаг включения/выключения}

## 12. Testing Strategy

| Type | Scope | Approach |
|------|-------|----------|
| Unit | {scope} | {approach} |
| Integration | {scope} | {approach} |
| E2E | {scope} | {approach} |
| Manual | {scope} | {approach} |

- **Seams:** определи точки входа для тестирования на самом высоком возможном уровне.
- **Prior art:** ссылки на аналогичные тесты в кодовой базе.

## 13. Edge Cases & Failure Modes

- {edge case 1} → {expected behaviour}
- {edge case 2} → {expected behaviour}
- {failure mode 1} → {fallback / error handling}

## 14. Success Metrics

| Metric | Current | Target | How to measure |
|--------|---------|--------|----------------|
| {metric} | {current value} | {target value} | {method} |

## 15. Open Questions

- {question 1} — {owner / status}
- {question 2} — {owner / status}

## 16. Dependencies

- **External:** {зависимости от сторонних сервисов / библиотек}
- **Internal:** {зависимости от других команд / модулей}
- **Pre-requisites:** {что должно быть сделано до старта}

## 17. Release Plan

| Phase | Scope | Timeline | Success Criteria |
|-------|-------|----------|------------------|
| P1 (MVP) | {scope} | {date} | {criteria} |
| P2 | {scope} | {date} | {criteria} |

## 18. Out of Scope

- {что точно не делаем}

## 19. Appendix

- **Glossary:** {термины и определения}
- **References:** {ссылки на дизайн, исследования, аналоги}
- **Revision history:** {дата, автор, изменения}
```

## 4. Review & Handoff

1. Перед сохранением проверь PRD на:
   - Покрытие всех user stories функциональными требованиями
   - Наличие non-functional requirements (особенно если затрагивается UI)
   - Определённые метрики успеха
   - Учтённые edge cases
   - Ссылки на prior art в кодовой базе

2. Отдай PRD пользователю на ревью:
   - Выдели ключевые решения, которые требуют подтверждения
   - Укажи открытые вопросы, где нужно решение
   - Спроси, нужно ли что-то добавить/изменить

3. После аппрува обнови статус на `Approved`.
