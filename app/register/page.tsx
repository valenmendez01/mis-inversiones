import { register } from "../auth-actions";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-content1 p-8 shadow-md">
        <h2 className="text-center text-3xl font-bold">Crear Cuenta</h2>
        
        <form action={register} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Usuario</label>
            <input
              name="username"
              type="text"
              required
              className="w-full rounded-lg border border-default-200 bg-default-100 p-3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-default-200 bg-default-100 p-3"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-primary p-3 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Registrarse y crear portafolio
          </button>
        </form>

        <p className="text-center text-sm text-default-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}