# Mis inversiones

Aplicación web moderna construida con Next.js y HeroUI diseñada para la gestión de portafolios financieros. Su principal característica es la implementación de una arquitectura Multi-Tenant impulsada por Turso y Drizzle ORM, la cual aprovisiona de forma automática una base de datos privada y completamente aislada para cada usuario al momento de registrarse.

Además, la plataforma se integra en el backend con Yahoo Finance y APIs de cotización del Dólar CCL para valorizar los activos (acciones, CEDEARs, ETFs) en tiempo real, permitiendo a los usuarios registrar sus compras y ventas, y visualizar la evolución histórica de su dinero de forma segura y personalizada.

## Stack

- [Next.js 14](https://nextjs.org/docs/getting-started)
- [HeroUI v2](https://heroui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Tailwind Variants](https://tailwind-variants.org)
- [TypeScript](https://www.typescriptlang.org/)
- [Framer Motion](https://www.framer.com/motion/)
- [next-themes](https://github.com/pacocoursey/next-themes)

## Configuración para usar

### Instalar dependencias en raiz del proyecto (terminal VSCode)

```bash
npm install
```

### Iniciar turso en PowerShell
```bash
wsl  # instalarlo si da error
```
```bash
export PATH="/root/.turso:$PATH"
```
```bash
echo 'export PATH="/root/.turso:$PATH"' >> ~/.bashrc
```
```bash
turso # validación
```

### Iniciar sesion en turso
```bash
turso auth login --headless
```
Ir a la URL generada, copiar el Access Token y pegar en terminal directamente

### Crear organización
* No hace falta ya que por defecto, Turso crea una organización "personal" con el nombre de usuario de GitHub
* Listar las organizaciones para ver el nombre:
```bash
turso org list
```
Copiar el SLUG --> Variable .env **TURSO_ORG_NAME**

### Obtener API TOKEN
```bash
turso auth api-tokens mint api-inversiones
```
Copiar token --> Variable .env **TURSO_API_TOKEN**

### Crear grupo
Ir al dashboard de turso, eliminar el grupo default si existe, y crear grupo llamado "inversiones" con location en Virginia (es la mas cercana a Argentina)

### Crear base de datos master
```bash
turso db create master-db
```
Activar protección contra borrado (Delete Protection)
```bash
turso db config delete-protection enable master-db
```
Obtener la URL
```bash
turso db show master-db --url
```
Copiar URL --> Variable .env **TURSO_DATABASE_URL**

### Generar token de seguridad
```bash
turso db tokens create master-db
```
Copiar token --> Variable .env **TURSO_AUTH_TOKEN**

### Secreto para encriptar la cookie de sesión (JWT)
Generlo en una nueva en terminal de PowerShell
```bash
openssl rand -base64 32
```
Copiar codigo --> Variable .env <u><strong>AUTH_SECRET</strong></u>

### Crear las tablas en la base de datos
```bash
npx drizzle-kit push
```

### Correr el servidor de desarrollo
```bash
npm run dev
```

## Licencia

Licencia bajo el [MIT license](https://github.com/heroui-inc/next-app-template/blob/main/LICENSE).