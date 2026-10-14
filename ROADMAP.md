# Roadmap de aprendizaje — RemindMe API

Recrea este proyecto **a mano, fase por fase**. Al terminar cada fase, pídele a un
LLM que te evalúe con el prompt de la sección
[Cómo pedir la evaluación](#cómo-pedir-la-evaluación). **No avances de fase hasta
obtener `APROBADO`**.

> Convenciones del proyecto: features directos en `src/<feature>/` con archivos
> `kebab-case.<tipo>.ts` (`controller, service, repository, routes, schema, dto,
types, middleware, job, util, config, error`). DI manual por constructor
> (sin contenedores). Los controllers solo hablan HTTP; el modelo Prisma nunca
> sale al exterior (se responde con DTOs).

## Cómo pedir la evaluación

Copia y pega esto junto a tu solución de la fase:

```text
Actúa como evaluador. Te doy mi solución de la FASE N (<título>).
Criterios de aceptación de esa fase (ver ROADMAP.md):
<pega aquí los criterios de la fase>

Verifica: archivos esperados, comandos indicados y contratos HTTP/comportamientos.
Responde SOLO con una de estas dos opciones:
- APROBADO: si CUMPLE el 100% de los criterios.
- OBSERVADO: lista numerada de cada criterio incumplido, con el comando o
  evidencia que lo demuestra y qué archivo debo corregir.
No me des la solución, solo el veredicto y los fallos.
```

## Fase 0 — Bootstrap del proyecto

**Enunciado**: inicializa un proyecto Node + TypeScript ESM con `tsc` estricto y
scripts `dev`, `build`, `start`, `typecheck`.

**Alcance**: solo `package.json`, `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`,
`rootDir: src`, `outDir: dist`) y dependencias base (`express`, `dotenv`, `zod`,
`typescript`, `tsx`, `@types/*`). Nada de código fuente todavía.

**Criterios de aceptación**:

- [ ] `npm run typecheck` termina en verde (aunque sea sin archivos).
- [ ] `node >= 22` y `"type": "module"` en `package.json`.

## Fase 1 — Lint, formato y hooks

**Enunciado**: configura ESLint flat + Prettier + Husky pre-commit con lint-staged
(`eslint --fix`, `prettier --write`) más `tsc --noEmit`. Agrega `.editorconfig`,
`.nvmrc`, `.gitignore` (`node_modules`, `dist`, `.env`, `logs`).

**Alcance**: solo tooling. No cambies código de negocio.

**Criterios de aceptación**:

- [ ] `npm run lint` y `npm run format:check` en verde.
- [ ] Un commit de prueba ejecuta el hook (lint-staged + typecheck).

## Fase 2 — Entorno local con Docker

**Enunciado**: crea `docker-compose.yml` con `db` (`postgres:16-alpine`, puerto
`5432`, volumen persistente, healthcheck `pg_isready`) y `mailpit` (SMTP `1025`,
UI `8025`). Crea `.env.example` con todas las variables (ver tabla en `README.md`).

**Alcance**: no escribas aún el schema ni conectes la app.

**Criterios de aceptación**:

- [ ] `docker compose config` es válido y `docker compose up -d` deja ambos
      servicios `healthy`.
- [ ] `.env.example` incluye `DATABASE_URL`, `DIRECT_URL`, `JWT_*`, `OTP_*`,
      `MAIL_FROM`, `SMTP_*`, `PORT`.

## Fase 3 — Schema Prisma

**Enunciado**: define en `prisma/schema.prisma` los modelos `User`, `OtpCode`,
`Reminder`, `NotificationLog` y los enums `Frequency` (`ONCE, DAILY, WEEKLY,
MONTHLY`), `Priority` (`LOW, MEDIUM, HIGH`), `ReminderStatus`
(`PROCESSING, CANCELED`). `User.email` único con `@db.Citext`.

**Alcance**: solo el schema. Sin migraciones ni código.

**Criterios de aceptación**:

- [ ] `npx prisma validate` en verde.
- [ ] Índices en `OtpCode(userId, expiresAt)`, `Reminder(userId, status, nextReminderAt)`
      y `NotificationLog(reminderId, sentAt)`; `ON DELETE CASCADE` en las relaciones.

## Fase 4 — Migración y cliente

**Enunciado**: genera la migración `init` (debe incluir
`CREATE EXTENSION IF NOT EXISTS "citext"` **antes** de crear `users`) y el
Prisma Client. Crea el singleton en `src/config/db.config.ts`.

**Alcance**: `cp .env.example .env` apuntando al Postgres Docker. Sin endpoints.

**Criterios de aceptación**:

- [ ] `npx prisma migrate status` → up to date; existen las 4 tablas y
      `users.email` es tipo `citext`.
- [ ] `npx prisma generate` en verde y `prisma.user` accesible desde código.

## Fase 5 — Núcleo HTTP

**Enunciado**: implementa `src/config/env.config.ts` (Zod, fail-fast),
`src/config/logger.config.ts` (pino consola + archivo diario `logs/`),
`src/config/mailer.config.ts`, `src/app.ts` (helmet, cors, json, pino-http,
`GET /health`, 404 JSON, error handler) y `src/server.ts`.

**Alcance**: sin features. El error handler responde `{ error, details? }`.

**Criterios de aceptación**:

- [ ] `GET /health` → `200 { "ok": true }`; ruta inexistente → `404 { error }`.
- [ ] Sin `DATABASE_URL` o `JWT_SECRET` la app no arranca (error de validación).

## Fase 6 — Shared: middlewares y fechas

**Enunciado**: crea `validate-request.middleware.ts` (Zod → `400` con `details`),
`require-auth.middleware.ts` (Bearer JWT → `req.user`, `401` si falta/inválido),
`api-error.error.ts` (`ApiError` con helpers) y `date.util.ts`
(`computeNextReminder`, `rollForwardToFuture`).

**Alcance**: utilidades puras, sin repositorios.

**Criterios de aceptación**:

- [ ] Body inválido → `400` con `details`; sin `Authorization: Bearer` → `401`.
- [ ] `computeNextReminder(fecha, 'ONCE')` es `null`; `'DAILY'` suma 1 día,
      `'WEEKLY'` 7 días, `'MONTHLY'` 1 mes de calendario.

## Fase 7 — Users

**Enunciado**: implementa `src/users/` con `user.types.ts`, `user.repository.ts`
(interfaz `UserRepository` + `PrismaUserRepository.findOrCreate`), `user.service.ts`
y `user.dto.ts` con `toUserResponse` (solo `id, email, name`).

**Alcance**: sin endpoints; es la base de auth.

**Criterios de aceptación**:

- [ ] `findOrCreate` normaliza el email a minúsculas y no duplica usuarios.
- [ ] `toUserResponse` nunca expone campos internos.

## Fase 8 — OTP request-code

**Enunciado**: implementa `otp.repository.ts` (`create`, `findLatestValid`,
`consume`, `incrementAttempts`, `invalidatePrevious`), `auth.schema.ts`
(`requestCodeSchema`) y `AuthService.requestCode`: busca/crea usuario, invalida
OTPs previos, genera código de `OTP_LENGTH` dígitos, guarda hash bcrypt con
expiración `OTP_TTL_MINUTES` y lo envía por email. Expón
`POST /api/auth/request-code`.

**Alcance**: solo emisión. Nada de verificación todavía.

**Criterios de aceptación**:

- [ ] `POST /api/auth/request-code { email }` → `200` y el código llega a Mailpit
      (`http://localhost:8025`).
- [ ] En DB el código está hasheado (bcrypt) y los OTPs previos del usuario quedan
      consumidos.

## Fase 9 — OTP verify + JWT

**Enunciado**: implementa `verifyCodeSchema`, `AuthService.verifyCode`
(expiración, máximo 5 intentos → `429`, comparación bcrypt, consumo único,
firma JWT con `sub` + `email`) y `POST /api/auth/verify-code` → `{ token }`
(`AuthTokenDTO`).

**Alcance**: cierra el módulo `auth/` con `auth.controller.ts` y `auth.routes.ts`.

**Criterios de aceptación**:

- [ ] Código correcto → `200 { token }` usable como `Bearer` en fases siguientes.
- [ ] Código expirado o incorrecto → `401`; 5 fallos → `429`; código reutilizado → `401`.

## Fase 10 — Reminders: repositorio

**Enunciado**: crea `src/reminders/reminder.types.ts` y `reminder.repository.ts`
con la interfaz `ReminderRepository` (`create`, `findByUser`, `findByIdForUser`,
`updateForUser`, `findDue(now, limit)`, `markNotified`) y su implementación Prisma.

**Alcance**: acceso a datos puro, sin reglas de negocio.

**Criterios de aceptación**:

- [ ] `findDue` solo retorna `PROCESSING` con `nextReminderAt <= now`, ordenados y
      con `take` aplicado, incluyendo `user.email`.
- [ ] `markNotified(id, null)` → `CANCELED`; con fecha → actualiza `nextReminderAt`.

## Fase 11 — Reminders: schemas y DTOs

**Enunciado**: crea `reminder.schema.ts` (Zod: `note` 1–280, `nextReminderAt`
coercionado a fecha, enums con defaults `ONCE`/`MEDIUM`; update con al menos un
campo) y `reminder.dto.ts` (`CreateReminderDTO`, `UpdateReminderDTO`,
`ReminderResponseDTO` sin `userId`, mapper `toReminderResponse`).

**Alcance**: contratos de transporte. Sin service ni controller.

**Criterios de aceptación**:

- [ ] `note` de 281 caracteres → `400`; update vacío → `400`.
- [ ] `toReminderResponse` incluye `id, note, nextReminderAt, frequency, priority, status, createdAt` y **excluye** `userId`.

## Fase 12 — Reminders: service

**Enunciado**: implementa `ReminderService` sobre la interfaz del repositorio
(inyección por constructor): `create` rechaza `ONCE` con fecha pasada, `get`
lanza `404` si no es del usuario, `update` verifica pertenencia, `cancel`
delega con `status: CANCELED`. Todo retorna `ReminderResponseDTO`.

**Alcance**: testeable con repo mockeado, sin Prisma real.

**Criterios de aceptación**:

- [ ] Crear `ONCE` pasado → `400`; leer/editar reminder ajeno → `404`.
- [ ] Ningún método retorna el modelo Prisma directo.

## Fase 13 — Reminders: controller y routes

**Enunciado**: crea `reminder.controller.ts` (extrae `userId` de `req.user`,
delegación total al service, `201` al crear) y `reminder.routes.ts`
(`requireAuth` global + `validateBody` en POST/PATCH).

**Rutas**: `POST /`, `GET /` (`?status=`), `GET /:id`, `PATCH /:id`, `DELETE /:id`.

**Criterios de aceptación**:

- [ ] Sin token → `401` en las 5 rutas; usuario A no ve ni edita reminders de B.
- [ ] `DELETE` deja el registro en `CANCELED` (baja lógica, no borrado físico).

## Fase 14 — Email y logs de notificación

**Enunciado**: implementa `notifications/mail.service.ts` (interfaz `MailService`,
`SmtpMailService` con el transporter + `NoopMailService` para tests) y
`notification-log.repository.ts` (`log(reminderId, success, error?)`).

**Alcance**: infraestructura de envío. Sin worker todavía.

**Criterios de aceptación**:

- [ ] Enviar a Mailpit funciona con `SMTP_HOST=localhost:1025` sin credenciales.
- [ ] Cada envío (éxito o fallo) puede registrarse en `notification_logs`.

## Fase 15 — Worker de recordatorios

**Enunciado**: implementa `src/jobs/process-reminders.job.ts` con
`processDueReminders(now)`: toma vencidos (`findDue`), envía el email, registra
el log, calcula la siguiente fecha (`computeNextReminder` + `rollForwardToFuture`)
y llama `markNotified`. Programa `cron.schedule('* * * * *')` en `server.ts`
(salteable con `DISABLE_CRON=true`) y CLI `--run-once` (`npm run reminders:process`).

**Alcance**: `CANCELED` jamás se procesa; un fallo individual no aborta el lote.

**Criterios de aceptación**:

- [ ] `ONCE` vencido → email + `CANCELED` + log `success=true`.
- [ ] `DAILY` vencido hace 3 días → email + `nextReminderAt` en futuro (sin spam
      retroactivo); `CANCELED` vencido → ignorado.

## Fase 16 — Tests

**Enunciado**: agrega tests Vitest: `computeNextReminder`/`rollForwardToFuture`
(casos `ONCE/DAILY/WEEKLY/MONTHLY`), `toReminderResponse` (no filtra `userId`) y
`ReminderService` con repositorio mockeado (rechazo `ONCE` pasado, `404` ajeno).

**Criterios de aceptación**:

- [ ] `npm test` en verde con al menos esos 3 archivos de test.
- [ ] Ningún test toca la DB real ni envía emails reales (`NoopMailService`/mocks).

## Fase 17 — Integración final

**Enunciado**: guion E2E real (DB Docker + Mailpit): `request-code` → código de
Mailpit → `verify-code` → `POST /api/reminders` con `nextReminderAt` = ahora +1
min (`ONCE`) → esperar al cron → email recibido → reminder en `CANCELED` + fila
en `notification_logs`. Documenta el proyecto en `README.md` (stack, setup,
endpoints, worker, roadmap de mejoras).

**Criterios de aceptación**:

- [ ] La demo de 1 minuto funciona de extremo a extremo sin errores.
- [ ] `typecheck`, `lint`, `format:check` y `test` en verde; `git log` muestra
      commits convencionales por dominio.

## Apéndice — Mejoras futuras (fuera del flujo principal)

Opcionales, post-proyecto. No bloquean ninguna fase ni forman parte del flujo.
Cada mejora indica su prerrequisito.

- [ ] **Refresh tokens + revocación** (prerrequisito: Fase 9). Access corto +
      refresh rotado con lista de revocación (logout real). Criterio: refresh
      reutilizado → `401` y sesión cerrada.
- [ ] **Rate limiting** (prerrequisito: Fase 9). `express-rate-limit` en
      `request-code`/`verify-code` por IP+email. Criterio: ráfaga → `429`.
- [ ] **Listado avanzado** (prerrequisito: Fase 13). Paginación, filtros por
      prioridad/frecuencia y búsqueda en `GET /api/reminders`. Criterio:
      `?page&limit&priority` responden paginado.
- [ ] **Zona horaria y no molestar** (prerrequisito: Fase 15). Zona por usuario
      y ventana silenciosa. Criterio: vencido en ventana silenciosa se pospone.
- [ ] **Cola en vez de envío síncrono** (prerrequisito: Fase 15). SQS/BullMQ con
      reintentos y backoff. Criterio: fallo SMTP reintenta y queda en DLQ tras N.
- [ ] **Lock distribuido del worker** (prerrequisito: Fase 15). `FOR UPDATE SKIP LOCKED` o lease para réplicas. Criterio: 2 workers no duplican envíos.
- [ ] **OpenAPI/Swagger** (prerrequisito: Fase 13). Docs generadas desde Zod en
      `/api-docs`. Criterio: spec válida y probada con un cliente generado.
- [ ] **CI en GitHub Actions** (prerrequisito: Fase 16). `typecheck+lint+test`
      en cada push. Criterio: pipeline verde/bloqueante en `main`.
- [ ] **Frontend** (prerrequisito: Fase 17). Web/móvil consumiendo la API.
      Criterio: flujo login OTP + CRUD desde la UI.
- [ ] **Observabilidad** (prerrequisito: Fase 17). Métricas, tracing y alertas
      del cron. Criterio: fallo del worker genera alerta accionable.
