# RemindMe API

API REST para guardar pequeños recordatorios asociados a un usuario, con autenticación
passwordless por código OTP enviado al correo y un worker que notifica por email cada
minuto según la frecuencia configurada (`ONCE`, `DAILY`, `WEEKLY`, `MONTHLY`).

## Características

- CRUD de recordatorios (nota corta, próxima fecha, frecuencia, prioridad, estado).
- Usuarios identificados por email, sin contraseña: login con código OTP de 6 dígitos.
- Endpoints de recordatorios protegidos con JWT (Bearer).
- Cron cada minuto que envía por correo los recordatorios vencidos y recalcula la
  siguiente fecha según la frecuencia (`ONCE` se marca `CANCELED` tras notificar).
- Patrón repositorio + capa de DTOs: los controllers solo hablan HTTP y los
  services nunca exponen el modelo Prisma (sin `userId`, `codeHash`, etc.).
- Logs con `pino` (consola + archivo rotado por día) y trazabilidad de envíos en
  la tabla `notification_logs`.

## Stack tecnológico

| Área             | Tecnología                                           |
| ---------------- | ---------------------------------------------------- |
| Runtime/lenguaje | Node.js 22 + TypeScript (estricto)                   |
| Framework HTTP   | Express 5                                            |
| ORM / DB         | Prisma 6 + PostgreSQL 16 (local Docker, prod Neon)   |
| Auth             | OTP por email (bcrypt) + JWT                         |
| Email            | Nodemailer SMTP (local Mailpit, prod AWS SES)        |
| Cron             | node-cron (cada minuto) / EventBridge en AWS         |
| Validación       | Zod                                                  |
| Logs             | Pino + pino-http                                     |
| Calidad          | ESLint (flat), Prettier, Husky + lint-staged, Vitest |
| Infra local      | Docker Compose (Postgres + Mailpit)                  |
| Despliegue       | AWS (ECS/BEANSTALK + SES + EventBridge)              |

## Requisitos

- Node.js 22 (`nvm use`) y npm.
- Docker + Docker Compose (para Postgres y Mailpit en local).
- Cuenta en [Neon](https://neon.tech) solo para despliegue/producción.

## Inicio rápido (local)

```bash
# 1. Dependencias
npm install

# 2. Servicios locales (Postgres :5432, Mailpit SMTP :1025 + UI :8025)
docker compose up -d

# 3. Variables de entorno
cp .env.example .env

# 4. Migraciones (requiere la extensión citext, incluida en la migración init)
npx prisma migrate dev

# 5. API en modo desarrollo (cron cada minuto activo)
npm run dev
```

- API: `http://localhost:3000` · Salud: `GET /health`
- Bandeja de correo local: `http://localhost:8025`
- Para desactivar el cron en desarrollo: `DISABLE_CRON=true npm run dev`
- Ejecutar el worker manualmente una vez: `npm run reminders:process`

## Variables de entorno

| Variable          | Descripción                                            |
| ----------------- | ------------------------------------------------------ |
| `DATABASE_URL`    | Conexión Postgres (local Docker o Neon pooled en prod) |
| `DIRECT_URL`      | Conexión directa (migraciones)                         |
| `JWT_SECRET`      | Secreto de firma JWT (mín. 16 caracteres)              |
| `JWT_EXPIRES_IN`  | Expiración del token (ej. `15m`)                       |
| `OTP_TTL_MINUTES` | Vigencia del código OTP (def. `10`)                    |
| `OTP_LENGTH`      | Longitud del código (def. `6`)                         |
| `MAIL_FROM`       | Remitente de los correos                               |
| `SMTP_HOST/PORT`  | Servidor SMTP (`localhost`/`1025` con Mailpit)         |
| `SMTP_USER/PASS`  | Credenciales SMTP (vacías en local)                    |
| `PORT`            | Puerto HTTP de la API (def. `3000`)                    |
| `DISABLE_CRON`    | `true` desactiva el cron interno                       |

## Referencia API

### Auth (público)

**`POST /api/auth/request-code`** — envía el OTP al correo.

```json
{ "email": "test@example.com" }
```

Respuesta `200`: `{ "message": "Code sent if email is valid" }`

**`POST /api/auth/verify-code`** — canjea el OTP por un JWT.

```json
{ "email": "test@example.com", "code": "123456" }
```

Respuesta `200`: `{ "token": "eyJhbGciOi..." }`

Usa el token como `Authorization: Bearer <token>` en el resto de endpoints.

### Reminders (requieren Bearer)

**`POST /api/reminders`** — crear (ejemplo `ONCE` que avisa en 1 minuto;
genera la fecha con `date -u -d "+1 minute" +%Y-%m-%dT%H:%M:%S.000Z`).

```json
{
  "note": "pagar la luz",
  "nextReminderAt": "2026-10-14T14:30:00.000Z",
  "frequency": "ONCE",
  "priority": "HIGH"
}
```

- `frequency`: `ONCE | DAILY | WEEKLY | MONTHLY` (los `ONCE` exigen fecha futura).
- `priority`: `LOW | MEDIUM | HIGH`.
- Respuesta `201` con `ReminderResponseDTO` (sin campos internos como `userId`).

**`GET /api/reminders`** — listar los propios (filtrable `?status=PROCESSING|CANCELED`).

**`GET /api/reminders/:id`** — detalle (solo del dueño, `404` si no existe).

**`PATCH /api/reminders/:id`** — editar (al menos un campo).

```json
{ "priority": "LOW", "status": "CANCELED" }
```

**`DELETE /api/reminders/:id`** — baja lógica (pasa a `CANCELED`, el cron lo ignora).

## Worker de notificaciones

`src/jobs/process-reminders.job.ts` corre cada minuto (`* * * * *`):

1. Busca hasta 100 recordatorios `PROCESSING` con `nextReminderAt <= now()`.
2. Envía el email al dueño y guarda el resultado en `notification_logs`.
3. Recalcula la fecha: `ONCE → CANCELED`, `DAILY +1 día`, `WEEKLY +7 días`,
   `MONTHLY +1 mes` (con `rollForwardToFuture` para no spamear si el job estuvo
   caído). Los `CANCELED` nunca se procesan.

## Logs

- Aplicación: consola JSON + archivo diario `logs/app-YYYY-MM-DD.log`.
- Negocio: tabla `notification_logs` (`reminderId`, `sentAt`, `success`, `error`).
- Nunca se loguean OTP en claro ni tokens.

## Scripts

| Comando                       | Descripción                          |
| ----------------------------- | ------------------------------------ |
| `npm run dev`                 | API con recarga (`tsx watch`)        |
| `npm run build` / `npm start` | Compilar (`tsc`) y correr `dist/`    |
| `npm run typecheck`           | `tsc --noEmit`                       |
| `npm run lint` / `lint:fix`   | ESLint (el pre-commit corre `--fix`) |
| `npm run format`              | Prettier sobre todo el repo          |
| `npm test`                    | Vitest                               |
| `npm run reminders:process`   | Worker manual (una pasada)           |
| `npx prisma studio`           | Explorador visual de la DB           |

El hook pre-commit (Husky + lint-staged) ejecuta `eslint --fix`, `prettier --write`
y `tsc --noEmit` antes de cada commit.

## Estructura

```
src/
  app.ts server.ts
  config/        # env.config, db.config, logger.config, mailer.config
  shared/        # middlewares, errors, utils
  reminders/     # reminder.controller/service/repository/routes/schema/dto/types
  auth/          # auth.controller/service/routes/schema/dto + otp.repository
  users/         # user.repository/service/types/dto
  notifications/ # mail.service + notification-log.repository
  jobs/          # process-reminders.job
  types/         # aumento de tipos de Express
prisma/
  schema.prisma
  migrations/
tests/
docker-compose.yml  # db (postgres:16) + mailpit
```

Convención: features directos en `src/<feature>/` con archivos
`kebab-case.<tipo>.ts` (`controller, service, repository, routes, schema, dto,
types, middleware, job, util, config, error`). Los services reciben los
repositorios por constructor (DI manual) para poder mockearlos en tests.

## Despliegue (resumen)

- DB: Neon Postgres (`DATABASE_URL` pooled + `DIRECT_URL` directa).
- App: contenedor en ECS Fargate o Elastic Beanstalk con las mismas env vars.
- Email: AWS SES (SMTP o SDK) vía la abstracción `MailService`.
- Cron: EventBridge Scheduler cada minuto → endpoint interno o `npm run reminders:process`.
- Migraciones en release: `npx prisma migrate deploy`.

## Futuras mejoras

- [ ] Refresh tokens + rotación y lista de revocación (logout real).
- [ ] Rate limiting por IP/email en `request-code` y `verify-code` (ej. `express-rate-limit`).
- [ ] Paginación, filtros por prioridad/frecuencia y búsqueda en `GET /api/reminders`.
- [ ] Zona horaria por usuario y ventana de "no molestar".
- [ ] Reintentos con backoff + cola (SQS/BullMQ) en vez de envío síncrono en el cron.
- [ ] Lock distribuido (`SELECT ... FOR UPDATE SKIP LOCKED`) para correr el worker con réplicas.
- [ ] Documentación OpenAPI/Swagger generada desde los schemas Zod.
- [ ] Tests de integración (Supertest + DB efímera) y CI en GitHub Actions.
- [ ] Frontend (web/móvil) consumiendo esta API.
- [ ] Observabilidad: métricas, tracing y alertas si el cron falla.
