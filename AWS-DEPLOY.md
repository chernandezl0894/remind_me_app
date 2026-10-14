# Manual de despliegue AWS — RemindMe API

Guía 100% manual y educativa, orientada a **practicar los servicios AWS que más
piden las ofertas de backend** usando este proyecto. Cada sección tiene:
**por qué lo piden**, **laboratorio paso a paso** y **checkpoint**
(verificación + pregunta típica de entrevista).

> Región usada en la guía: `us-east-1`. Ajusta los comandos si eliges otra.
> Servicios con costo: vigila la sección [Costos y limpieza](#costos-y-limpieza).

## Mapa de la arquitectura

```text
                    ┌───────────── VPC ──────────────┐
Internet → ALB ─────▶ ECS Fargate (API :3000) ──────▶ RDS Postgres :5432
 (público)  │        (subred privada)   │              (subred privada)
            │                           ├────────────▶ SES (emails)
            │                           └────────────▶ Secrets Manager
            └──── EventBridge (cron/min) ──▶ ECS task (worker --run-once)
CloudWatch Logs + alarmas ──▶ SNS (avisos a tu correo)
```

## 0. Pre-requisitos

**Por qué lo piden**: AWS CLI y perfiles IAM son el día a día en cualquier equipo.

```bash
aws --version   # v2
docker --version
```

1. Crea un usuario IAM `remind-me-admin` con `AdministratorAccess` (solo para
   practicar; en empresas reales se usa mínimo privilegio).
2. Genera su _Access Key_ y configura un perfil dedicado (no pises el del trabajo):
   ```bash
   aws configure --profile remind-me
   # Access Key ID: ...
   # Secret Access Key: ...
   # region: us-east-1
   # output: json
   ```
3. Exporta el perfil para esta práctica: `export AWS_PROFILE=remind-me`.

**Checkpoint**: `aws sts get-caller-identity` muestra tu usuario. Pregunta de
entrevista: _¿diferencia entre usuario, rol y policy en IAM?_

## 1. Red: VPC y security groups

**Por qué lo piden**: es el filtro nº 1 en entrevistas; quien no explica
subred pública vs privada queda fuera.

Laboratorio (consola: VPC → Create VPC → _VPC and more_):

1. Crea VPC `remind-me-vpc` (`10.0.0.0/16`) con 2 AZ, 2 subredes públicas y
   2 privadas, NAT gateway en una AZ.
2. Security groups:
   - `remind-me-alb-sg`: entrada `80/443` desde `0.0.0.0/0`.
   - `remind-me-api-sg`: entrada `3000` solo desde `remind-me-alb-sg`.
   - `remind-me-rds-sg`: entrada `5432` solo desde `remind-me-api-sg`.

**Checkpoint**: el ALB responde, la API no es alcanzable directa desde internet y
RDS solo acepta conexiones de la API. Pregunta de entrevista: _¿por qué la base
de datos va en subred privada?_

## 2. Base de datos: RDS Postgres

**Por qué lo piden**: provisioning, backups, alta disponibilidad y
conectividad segura son preguntas clásicas.

1. RDS → Create database → _Standard create_, engine **PostgreSQL 16**,
   plantilla _Free tier_ (`db.t3.micro`, 20 GB gp3).
2. `DB instance identifier`: `remind-me-db`. Guarda usuario/contraseña.
3. Conectividad: _Don't connect to EC2_, VPC `remind-me-vpc`, subredes privadas,
   SG `remind-me-rds-sg`, _Public access: No_.
4. Habilita _Automated backups_ (7 días) y anota el endpoint.
5. Conéctate una vez (desde una tarea ECS de prueba o EC2 temporal en la VPC):
   ```sql
   CREATE EXTENSION IF NOT EXISTS "citext";
   ```
   (La migración `init` ya lo incluye, pero RDS nuevo debe permitirlo: el rol
   `rds_superuser` lo permite por defecto.)
6. Aplica el schema desde tu máquina con la URL del endpoint:
   ```bash
   DATABASE_URL="postgresql://<user>:<pass>@<endpoint>:5432/remind_me?schema=public" \
   DIRECT_URL=$DATABASE_URL npx prisma migrate deploy
   ```

**Checkpoint**: `SELECT * FROM users;` funciona y `_prisma_migrations` lista
`20261014192113_init`. Pregunta de entrevista: _RDS vs Neon/self-hosted, ¿cuándo
cada uno?_ (respuesta modelo: RDS = control + backups + VPC; Neon = serverless
y branching barato para dev/preview).

## 3. Email: SES

**Por qué lo piden**: reputación de correo (DKIM/SPF), sandbox y rebotes salen
en entrevistas de cualquier app que notifique.

1. SES → _Verified identities_ → verifica `cristhianjhl.web@gmail.com`
   (clic en el email de confirmación) o tu dominio con DKIM.
2. **Sandbox**: la cuenta nueva solo envía a identidades verificadas. Para salir:
   SES → _Account dashboard_ → _Request production access_ (caso de uso:
   "recordatorios transaccionales, ~X emails/día, solo opt-in").
3. SES → _SMTP settings_ → _Create SMTP credentials_ (usuario IAM dedicado).
   Mapea a `SMTP_HOST` (ej. `email-smtp.us-east-1.amazonaws.com`), puerto `587`,
   `SMTP_USER/PASS`, `MAIL_FROM` = identidad verificada.

**Checkpoint**: envía un correo de prueba desde la consola SES y recíbelo.
Pregunta de entrevista: _¿qué pasa con rebotes/quejas y cómo los manejarías?_
(SNS + suppression list + tabla de estado).

## 4. Imagen Docker y ECR

**Por qué lo piden**: multi-stage builds y registries privados son rutina.

`Dockerfile` (multi-stage, crea `Dockerfile` en la raíz):

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
aws ecr create-repository --repository-name remind-me
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t remind-me .
docker tag remind-me:latest <account>.dkr.ecr.us-east-1.amazonaws.com/remind-me:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/remind-me:latest
```

**Checkpoint**: la imagen aparece en ECR. Pregunta de entrevista: _¿por qué
multi-stage?_ (imagen final pequeña, sin devDeps ni código fuente/secretos).

## 5. Secretos

**Por qué lo piden**: "nunca env vars en plano" es respuesta esperada siempre.

1. Secrets Manager → _Store a new secret_ → _Other type_: guarda
   `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SMTP_USER`, `SMTP_PASS`,
   `MAIL_FROM` como JSON bajo el nombre `remind-me/api`.
2. Crea un rol de ejecución ECS (`ecsTaskExecutionRole`) con la policy
   `SecretsManagerReadWrite` acotada a ese secreto (mínimo privilegio).

**Checkpoint**: muestra que la task definition referencia el secreto por ARN,
nunca el valor. Pregunta de entrevista: _Secrets Manager vs Parameter Store?_
(secretos con rotación vs config simple y barata).

## 6. API en ECS Fargate + ALB

**Por qué lo piden**: es el despliegue "estándar empresa" que describen las ofertas.

1. ECS → _Task definitions_ → `remind-me-api`: imagen ECR, 256 CPU / 512 MB,
   puerto `3000`, env `PORT=3000`, `DISABLE_CRON=true` (el worker va aparte),
   secretos desde Secrets Manager, log driver `awslogs`.
2. ECS → _Cluster_ `remind-me` (Fargate) → _Service_: 1 tarea (luego 2),
   subredes privadas, SG `remind-me-api-sg`.
3. EC2 → _Load Balancers_ → ALB en subredes públicas, SG `remind-me-alb-sg`,
   target group con health check `GET /health` (espera `200 { ok: true }`),
   listener `80` → target group.
4. Migraciones en cada release (one-off antes de desplegar):
   ```bash
   aws ecs run-task --cluster remind-me --launch-type FARGATE \
     --network-configuration "..." \
     --overrides '{"containerOverrides":[{"name":"api","command":["npx","prisma","migrate","deploy"]}]}'
   ```

**Checkpoint**: `curl http://<alb-dns>/health` → `{"ok":true}`; el flujo
`request-code → verify-code → CRUD` funciona contra el ALB. Pregunta de
entrevista: _¿cómo haces un deploy sin downtime?_ (rolling update + health check

- target deregistration delay).

## 7. Cron con EventBridge Scheduler

**Por qué lo piden**: separar workers del API y programar tareas es escenario
típico ("¿cómo correrías esto cada minuto?").

1. Crea segunda task definition `remind-me-worker` (misma imagen, comando
   `["node","dist/server.js"]` con override a `npm run reminders:process` o
   variable que ejecute una pasada; la API principal lleva `DISABLE_CRON=true`
   para no duplicar envíos).
2. EventBridge Scheduler → _Create schedule_: `cron(* * * * ? *)` (cada minuto),
   target _ECS RunTask_ (cluster `remind-me`, task `remind-me-worker`, subredes
   privadas), rol con permiso `ecs:RunTask`.
3. Verifica en CloudWatch Logs que cada ejecución procesa vencidos y que un
   `ONCE` queda `CANCELED` + fila en `notification_logs`.

**Checkpoint**: crea un reminder a +2 min y recibe el SES en tu correo.
Pregunta de entrevista: _con 2 réplicas del worker, ¿cómo evitas doble envío?_
(`SELECT ... FOR UPDATE SKIP LOCKED` o campo de lease; ver mejoras futuras).

## 8. Observabilidad

**Por qué lo piden**: "¿cómo te enteras de que falló?" cierra casi toda entrevista.

1. CloudWatch → _Log groups_: `/ecs/remind-me-api` y `/ecs/remind-me-worker`
   (pino ya emite JSON, filtrable por `level >= 50`).
2. CloudWatch → _Alarms_: 5xx del ALB > umbral, CPU del servicio > 80%, fallos
   del schedule de EventBridge.
3. SNS → tema `remind-me-alerts` suscrito a tu email como acción de las alarmas.

**Checkpoint**: provoca un `500` (ej. token inválido repetido no; mejor detén
RDS 1 min en dev) y recibe el aviso. Pregunta de entrevista: _¿qué métricas de
negocio monitorearías además de técnicas?_ (recordatorios enviados/fallidos por
hora desde `notification_logs`).

## 9. CI/CD mínimo (fase 2 recomendada)

_GitHub Actions_: en push a `main` → `npm ci` → `typecheck` + `lint` + `test` →
build/push a ECR → `aws ecs update-service --force-new-deployment`. Las ofertas
piden "deploy automático": este pipeline es tu respuesta demostrable.

## Costos y limpieza

- Free tier aprox: `db.t3.micro` 750 h/mes el primer año, ALB **no** es gratis
  (~$16/mes + LCU), NAT Gateway cobra por hora + datos, SES cobra por email
  fuera del sandbox inicial. Apaga cuando no practiques.
- Orden de borrado: EventBridge schedule → ECS service → ALB → RDS (conserva
  snapshot final si quieres) → NAT/VPC → ECR → secretos → logs.

## Anexo — Preguntas de entrevista modelo (con este proyecto)

1. ¿Cómo evitas que dos réplicas notifiquen el mismo reminder? → lock pesimista
   o lease con `processingAt`; idealmente cola SQS FIFO.
2. ¿Dónde guardas secretos y cómo llegan al contenedor? → Secrets Manager por
   ARN en la task definition, nunca en la imagen.
3. ¿Cómo haces rollback de un deploy malo? → `update-service` a la task
   definition anterior + `migrate` solo con migraciones compatibles hacia atrás.
4. ¿Cómo escala la API en picos? → ALB + Service Auto Scaling por CPU/request
   count; la DB con réplica de lectura si hiciera falta.
5. El cron tarda más de 1 minuto, ¿qué pasa? → solapamiento; sácalo a worker
   único o cola en vez de cron embebido.

## Apéndice — Mejoras futuras de infraestructura (fuera del flujo principal)

Opcionales, post-despliegue. Cada una indica su prerrequisito.

- [ ] **HTTPS con ACM + Route 53** (prerrequisito: §6). Certificado gratuito,
      alias al ALB, redirect 80→443. Checkpoint: `curl https://.../health` 200.
- [ ] **RDS Multi-AZ + réplica de lectura** (prerrequisito: §2). Failover
      automático; lecturas pesadas a la réplica. Checkpoint: failover simulado
      sin pérdida de datos.
- [ ] **Auto Scaling del servicio ECS** (prerrequisito: §6+§8). Target tracking
      CPU 70%. Checkpoint: carga sintética escala de 1 a 3 tareas y vuelve.
- [ ] **WAF en el ALB** (prerrequisito: §6). Rate limiting y reglas gestionadas.
      Checkpoint: ráfaga de `request-code` queda bloqueada con 403.
- [ ] **IaC con Terraform o CDK** (prerrequisito: todo el manual). Reproduce la
      infraestructura con `plan/apply`. Checkpoint: `terraform destroy/apply`
      levanta el stack idéntico.
- [ ] **Pipeline completo con migraciones** (prerrequisito: §9). `migrate deploy`
      como paso previo al `update-service`, con aprobación manual en prod.
      Checkpoint: deploy verde + `migrate status` up to date.
- [ ] **Observabilidad avanzada** (prerrequisito: §8). Métricas de negocio
      (enviados/fallidos por hora) + dashboard + tracing X-Ray. Checkpoint:
      dashboard con tasa de fallo de notificaciones.
