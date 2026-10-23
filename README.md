# GreenPulse

GreenPulse es una plataforma web para la gestión de residuos industriales en Lácteos Los Andes. Permite registrar mermas (pérdidas de material), validarlas, controlar el movimiento de residuos y generar indicadores para la toma de decisiones.

## Roles de usuario

- **Operario**: Registra mermas asociadas a su línea de producción y turno.
- **Supervisor**: Valida, corrige o rechaza registros. Gestiona entradas y salidas de residuos en las zonas de acopio.
- **HSSA (jefe)**: Administra usuarios, catálogos operativos, efluentes y reportes. Es el único rol con permiso para crear cuentas y asignar los demás roles (operario, supervisor, HSSA y gerencia).
- **Gerencia**: Consulta indicadores, tendencias y cumplimiento ambiental.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (se recomienda una versión LTS).
- Una instancia de MongoDB accesible, local o remota.
- Git.

## Clonar e instalar

1. Clona el repositorio y entra a la carpeta del proyecto:

   ```powershell
   git clone https://github.com/mendezchacinga/sistema-gestion-desechos.git
   cd GreenPulse
   ```

2. Instala las dependencias:

   ```powershell
   npm install
   ```

## Configuración

Crea un archivo llamado `.env` en la raíz del proyecto. No lo subas al repositorio ni incluyas credenciales reales en el código.

```env
db_url=mongodb://<usuario>:<contraseña>@<host>:<puerto>/<base_de_datos>?<opciones>
jwt_secret=<una_clave_larga_y_aleatoria>
```

Para una instalación local de MongoDB, la URL puede tener este formato:

```env
db_url=mongodb://127.0.0.1:27017
jwt_secret=reemplaza-esto-por-una-clave-segura
```

## Ejecutar la aplicación

Inicia el servidor:

```powershell
npm start
```

Cuando el arranque sea correcto, la consola mostrará:

```text
Application is running successfully
DB Connected
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

Para desarrollo con reinicio automático al guardar cambios:

```powershell
npm run dev
```

## Interfaz React

El cliente React está en `frontend/` e incluye el inicio de sesión y los paneles para cada rol (operario, supervisor, HSSA, gerencia). Consume rutas JSON bajo `/api/operations` y conserva las cookies HTTP-only del servidor para la autenticación.

En una primera terminal, inicia el servidor actual:

```powershell
npm start
```

En una segunda terminal, inicia React:

```powershell
npm run react:dev
```

Abre [http://localhost:5173](http://localhost:5173). Vite redirige las llamadas a `/api` al servidor Express del puerto 3000 durante desarrollo.

Para comprobar que el cliente puede compilarse para producción:

```powershell
npm run react:build
```

El build se publica desde Express en [http://localhost:3000](http://localhost:3000).

## Estructura del proyecto

```
GreenPulse/
├── controllers/        # Lógica de negocio (operationsController)
├── routes/             # Definición de rutas de la API
├── middleware/         # Autenticación y autorización
├── config/             # Conexión a MongoDB
├── frontend/           # Cliente React (Vite)
│   └── src/            # Componentes y estilos
├── public/             # Vistas EJS (admin, driver, user)
├── utils/              # Utilidades (JWT, contraseñas)
├── app.js              # Configuración de Express
└── package.json
```

## API principal

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Inicio de sesión |
| `GET` | `/api/operations/losses` | Listar mermas |
| `POST` | `/api/operations/losses` | Registrar merma |
| `PATCH` | `/api/operations/losses/:id` | Validar/corrigir/rechazar merma |
| `GET` | `/api/operations/movements` | Listar movimientos de residuos |
| `POST` | `/api/operations/storage` | Entrada a acopio |
| `POST` | `/api/operations/dispatches` | Salida/despacho |
| `GET` | `/api/operations/zones` | Listar zonas de acopio |
| `GET` | `/api/operations/catalogs/:type` | Listar catálogos |
| `POST` | `/api/operations/catalogs/:type` | Agregar elemento a catálogo |
| `GET` | `/api/operations/hssa/users` | Listar usuarios |
| `POST` | `/api/operations/hssa/users` | Crear usuario |
| `PATCH` | `/api/operations/hssa/users/:email` | Editar usuario |
| `DELETE` | `/api/operations/hssa/users/:email` | Eliminar usuario |

La creación de cuentas (asignación de roles) solo está disponible para el rol **HSSA (jefe)**, a través de `POST /api/operations/hssa/users`. No existe registro público de cuentas.

## Solución de problemas

### El puerto 3000 ya está en uso (`EADDRINUSE`)

Ya hay otra instancia de la aplicación —u otro proceso— ejecutándose en el puerto 3000. Detén la instancia anterior con `Ctrl+C` y vuelve a ejecutar `npm start`.

En Windows también puedes identificar el proceso con:

```powershell
netstat -ano | Select-String ':3000'
```

Luego ciérralo, sustituyendo `<PID>` por el identificador mostrado:

```powershell
Stop-Process -Id <PID>
```

### No se conecta a MongoDB

Comprueba que MongoDB esté en ejecución y que `db_url` en `.env` sea correcta. Revisa además las credenciales, el host, el puerto y la configuración de acceso de red de la instancia.

## Pruebas

Actualmente no hay una suite automatizada configurada. El comando `npm test` termina con error intencionalmente hasta que se agreguen pruebas.
