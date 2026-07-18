import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { type Project } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { HugeIcon } from "@/components/huge-icon";
import { CreateProjectModal } from "@/components/create-project-modal";
import styles from "./organization-switcher.module.scss";

const RESERVED = new Set(["organizations", "users", "inquiries"]);

function projectTabSegment(pathname: string): string {
  const match = pathname.match(/^\/dashboard\/([^/]+)(?:\/(.*))?$/);
  const first = match?.[1];
  if (!first || RESERVED.has(first)) return "";
  return match?.[2] ?? "";
}

export function ProjectSwitcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    can,
    isOrgOwner,
    currentOrganization,
    projects,
    currentProject,
    setCurrentProject,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const showSwitcher = can("projects");
  const canCreate = isOrgOwner && Boolean(currentOrganization);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!showSwitcher) return null;

  function selectProject(project: Project) {
    const segment = projectTabSegment(pathname);
    setCurrentProject(project);
    setOpen(false);
    navigate(segment ? `/dashboard/${project.id}/${segment}` : `/dashboard/${project.id}`);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <span className={styles.label}>Project</span>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        disabled={!currentOrganization}
      >
        <span className={styles.triggerText}>
          {currentProject?.name ?? (currentOrganization ? "Select project" : "Select an organization")}
        </span>
        <HugeIcon icon={ArrowDown01Icon} size={16} className={styles.chevron} />
      </button>

      {open ? (
        <div className={styles.popover}>
          <div id={listId} className={styles.list} role="listbox">
            {projects.length === 0 ? (
              <p className={styles.empty}>No projects yet</p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  role="option"
                  aria-selected={project.id === currentProject?.id}
                  className={`${styles.option} ${
                    project.id === currentProject?.id ? styles.optionActive : ""
                  }`}
                  onClick={() => selectProject(project)}
                >
                  {project.name}
                </button>
              ))
            )}
          </div>
          {canCreate ? (
            <button
              type="button"
              className={styles.addButton}
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              Add project
            </button>
          ) : null}
        </div>
      ) : null}

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
