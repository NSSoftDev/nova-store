/**
 * Empty / error placeholder with icon, title, text and optional actions.
 */
import { Icon } from '../lib/icons.jsx';

export default function EmptyState({ icon = 'search', title, text, children, className = '' }) {
  return (
    <div className={`empty ${className}`.trim()}>
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
