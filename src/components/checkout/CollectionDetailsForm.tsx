'use client';

import { useRef, useState } from 'react';
import { customerSchema, digits, type Customer } from '@/ordering/checkout/validation';
import { CarBrandPicker } from './CarBrandPicker';
import type { Lang } from '@/i18n/localize';

type Text = (en: string, ar: string) => string;

/**
 * Owns draft customer state so keystrokes do not re-render the parked menu
 * still mounted under OrderingExperience.
 */
export function CollectionDetailsForm({
  initial,
  lang,
  text,
  onValid,
  onDraft,
}: {
  initial: Customer;
  lang: Lang;
  text: Text;
  onValid: (customer: Customer) => void;
  onDraft: (customer: Customer) => void;
}) {
  const [customer, setCustomer] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const draft = useRef(customer);
  draft.current = customer;

  function commit(patch: (current: Customer) => Customer) {
    const next = patch(draft.current);
    draft.current = next;
    setCustomer(next);
    onDraft(next);
  }

  function validate(event: React.FormEvent) {
    event.preventDefault();
    const result = customerSchema.safeParse(draft.current);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => String(issue.path[0]));
      setErrors(fields);
      document.getElementById(`collection-${fields[0]}`)?.focus();
      return;
    }
    setErrors([]);
    onValid(result.data);
  }

  return (
    <form id="collection-details" onSubmit={validate} noValidate>
      <div className="checkout-fields">
        {(['name', 'phone', 'brand', 'plate'] as const).map((key) => {
          if (key === 'brand') {
            return (
              <CarBrandPicker
                key={key}
                value={customer.brand}
                lang={lang}
                invalid={errors.includes('brand')}
                onChange={(brand) => {
                  commit((current) => ({ ...current, brand }));
                  setErrors((current) => current.filter((field) => field !== 'brand'));
                }}
              />
            );
          }
          const label = {
            name: text('Your name', 'اسمك'),
            phone: text('Mobile number', 'رقم الجوال'),
            plate: text('Qatar plate number', 'رقم اللوحة القطرية'),
          }[key];
          const invalid = errors.includes(key);
          if (key === 'plate') {
            return (
              <div key={key} className="checkout-field field-plate">
                <label htmlFor="collection-plate">{label}</label>
                <div className="plate-entry" dir="ltr">
                  <span className="plate-country">
                    <span className="plate-flag" aria-hidden="true">🇶🇦</span>
                    <span>QATAR<br /><span lang="ar">قطر</span></span>
                  </span>
                  <input
                    id="collection-plate"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    minLength={3}
                    maxLength={6}
                    pattern="[0-9]{3,6}"
                    placeholder="000000"
                    value={customer.plate.slice(1)}
                    aria-label={text('Plate number, 3 to 6 digits', 'رقم اللوحة، من ٣ إلى ٦ أرقام')}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? 'hint-plate' : undefined}
                    onChange={(e) => {
                      const number = digits(e.target.value).replace(/\D/g, '').slice(0, 6);
                      commit((current) => ({ ...current, plate: `${current.plate[0] || 'Q'}${number}` }));
                      setErrors((current) => current.filter((x) => x !== 'plate'));
                    }}
                  />
                  <strong className="plate-current-series" aria-hidden="true">{customer.plate[0] || 'Q'}</strong>
                </div>
                <div className="plate-series" role="group" aria-label={text('Plate letter', 'حرف اللوحة')}>
                  {(['Q', 'T', 'R'] as const).map((series) => (
                    <button
                      key={series}
                      type="button"
                      className={customer.plate[0] === series ? 'selected' : ''}
                      aria-pressed={customer.plate[0] === series}
                      onClick={() => {
                        commit((current) => ({ ...current, plate: `${series}${current.plate.slice(1)}` }));
                        setErrors((current) => current.filter((x) => x !== 'plate'));
                      }}
                    >
                      {series}
                    </button>
                  ))}
                </div>
                {invalid && (
                  <small id="hint-plate" className="field-error">
                    {text('Enter 3–6 digits and choose Q, T or R.', 'أدخل من ٣ إلى ٦ أرقام واختر Q أو T أو R.')}
                  </small>
                )}
              </div>
            );
          }
          return (
            <label key={key} className={`checkout-field field-${key}`} htmlFor={`collection-${key}`}>
              <span>{label}</span>
              {key === 'phone' ? (
                <div className="qatar-phone-field" dir="ltr">
                  <span className="qatar-phone-prefix">
                    <span role="img" aria-label={text('Qatar flag', 'علم قطر')}>🇶🇦</span> +974
                  </span>
                  <input
                    id="collection-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    pattern="[0-9]*"
                    required
                    maxLength={8}
                    value={customer.phone.replace(/^974/, '')}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? 'hint-phone' : undefined}
                    onChange={(e) => {
                      const national = digits(e.target.value).replace(/\D/g, '').slice(0, 8);
                      commit((current) => ({ ...current, phone: national ? `974${national}` : '' }));
                      setErrors((current) => current.filter((x) => x !== 'phone'));
                    }}
                  />
                </div>
              ) : (
                <input
                  id={`collection-${key}`}
                  type="text"
                  autoComplete={key === 'name' ? 'name' : 'off'}
                  required
                  maxLength={100}
                  value={customer[key]}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `hint-${key}` : undefined}
                  onChange={(e) => {
                    const value = e.target.value;
                    commit((current) => ({ ...current, [key]: value }));
                    setErrors((current) => current.filter((x) => x !== key));
                  }}
                />
              )}
              {invalid && (
                <small id={`hint-${key}`} className="field-error">
                  {key === 'phone'
                    ? text('Enter a valid Qatar mobile number.', 'أدخل رقم جوال قطرياً صالحاً.')
                    : text('Please enter your name.', 'يرجى إدخال اسمك.')}
                </small>
              )}
            </label>
          );
        })}
      </div>
      <details className="optional-vehicle">
        <summary>{text('Add vehicle details', 'أضف تفاصيل السيارة')}</summary>
        <div className="checkout-fields">
          {(['colour', 'instructions'] as const).map((key) => (
            <label key={key} className={`checkout-field field-${key}`} htmlFor={`collection-${key}`}>
              <span>
                {{
                  colour: text('Car colour', 'لون السيارة'),
                  instructions: text('Collection instructions', 'تعليمات الاستلام'),
                }[key]}
              </span>
              {key === 'instructions' ? (
                <textarea
                  id={`collection-${key}`}
                  value={customer[key]}
                  maxLength={400}
                  rows={3}
                  onChange={(e) => {
                    const value = e.target.value;
                    commit((current) => ({ ...current, [key]: value }));
                  }}
                />
              ) : (
                <input
                  id={`collection-${key}`}
                  value={customer[key]}
                  maxLength={50}
                  onChange={(e) => {
                    const value = e.target.value;
                    commit((current) => ({ ...current, [key]: value }));
                  }}
                />
              )}
            </label>
          ))}
        </div>
      </details>
    </form>
  );
}
