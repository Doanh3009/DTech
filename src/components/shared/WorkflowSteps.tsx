import styles from "./WorkflowSteps.module.css";

export function WorkflowSteps({ steps, current, label, completed = false }: { steps: string[]; current: number; label: string; completed?: boolean }) {
  return <ol aria-label={completed ? `${label} · Đã hoàn tất` : label} className={styles.steps}>{steps.map((step, index) => <li aria-current={!completed && index === current ? "step" : undefined} className={completed || index < current ? styles.done : index === current ? styles.current : undefined} key={step}><span aria-hidden="true">{completed || index < current ? "✓" : index + 1}</span>{step}</li>)}</ol>;
}
