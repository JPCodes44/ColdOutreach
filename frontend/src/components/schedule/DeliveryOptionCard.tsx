import { Icon } from '../outreach/Common';
import type { DeliveryOptionCardProps } from './types';

/** A radio-style card for one delivery method. */
export function DeliveryOptionCard({
  option,
  selected,
  onSelect,
}: DeliveryOptionCardProps) {
  return (
    <button
      className={`scheduleDelivery ${selected ? 'scheduleDeliverySelected' : ''}`}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(option.id)}
    >
      <span className="scheduleDeliveryIcon">
        <Icon name={option.iconName} size={20} />
      </span>
      <span className="scheduleDeliveryText">
        <span className="scheduleDeliveryTitle">{option.title}</span>
        <span className="scheduleDeliveryDesc">{option.description}</span>
      </span>
      <span className="scheduleDeliveryMark">
        <Icon
          name={selected ? 'check_circle' : 'radio_button_unchecked'}
          size={20}
          fill={selected}
        />
      </span>
    </button>
  );
}
