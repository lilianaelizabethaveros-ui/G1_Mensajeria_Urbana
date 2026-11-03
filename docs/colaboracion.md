# Colaboración con Git y GitHub

*El procedimiento completo de creación del repositorio, colaboradores y Pull Requests se
detalla en la Fase 6. Aquí quedan las reglas acordadas.*

## Ramas

| Rama | Responsable | Se crea desde |
| --- | --- | --- |
| `main` | Protegida: solo entra por Pull Request | — |
| `feat/liliana-envios` | Liliana | `main` inicial |
| `feat/camila-despacho` | Camila | `main` **después** de integrar la base de Liliana |
| `feat/juan-seguimiento` | Juan Fernando | `main` **después** de integrar la base de Liliana |

## Reglas para evitar conflictos

1. Cada integrante modifica solo sus carpetas (ver `README.md`).
2. `backend/src/routes/index.js` ya registra los seis módulos: nadie lo edita para añadir endpoints.
3. Cambios en `docker-compose.yml`, `.env.example`, `package.json` o `backend/src/shared/` van en un
   Pull Request pequeño y separado, avisando al grupo. Una dependencia nueva requiere acuerdo previo.
4. Migraciones por rangos: 001–099 Liliana, 100–199 Camila, 200–299 Juan Fernando.
5. Commits pequeños y descriptivos con la identidad Git propia. Ejemplo: `feat(envios): validar campos del formulario`.
6. `.gitattributes` normaliza los finales de línea (LF).

## Actualizar tu rama con lo último de `main`

Hazlo antes de empezar a trabajar y antes de abrir un Pull Request:

```powershell
# 1. Comprobar que no hay cambios sin guardar
git status
#    Debe decir "nothing to commit, working tree clean".
#    Si no, guarda tu trabajo con un commit antes de seguir:
#    git add <archivos>; git commit -m "wip(modulo): descripcion"

# 2. Confirmar que estás en tu rama
git branch --show-current

# 3. Traer los cambios del repositorio sin tocar tus archivos
git fetch origin

# 4. Ver qué commits nuevos trae main (solo lectura)
git log --oneline HEAD..origin/main

# 5. Integrar main en tu rama
git merge origin/main

# 6. Verificar que todo sigue funcionando
docker compose up --build -d
Invoke-RestMethod http://localhost:3000/health

# 7. Subir tu rama actualizada
git push origin <tu-rama>
```

Si el paso 5 avisa de un conflicto: `git status`, abre en VS Code los archivos marcados, elige qué
conservar y termina con `git add <archivo>` y `git commit`. Si no estás segura, `git merge --abort`
deja la rama exactamente como estaba antes del paso 5.

**Prohibido sin acuerdo del grupo:** `git push --force`, `git reset --hard` y `git rebase` sobre ramas compartidas.
