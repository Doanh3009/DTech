"use client";

import {
  Eye,
  EyeOff,
  Search,
  type LucideIcon
} from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils/cn";
import { SelectControl } from "@/components/shared/SelectControl";
import { ComboboxControl } from "@/components/shared/ComboboxControl";
import { useIsPhone } from "@/lib/ui/useIsPhone";

export interface FormFieldProps {
  id?: string;
  label: string;
  labelHidden?: boolean;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  children: (fieldId: string, describedBy: string | undefined) => ReactNode;
}

export function RequiredIndicator() {
  return <span aria-hidden="true" className="field__required">*</span>;
}

export function FieldLabel({
  children,
  hidden,
  htmlFor,
  required
}: {
  children: ReactNode;
  hidden?: boolean;
  htmlFor: string;
  required?: boolean;
}) {
  return (
    <label className={hidden ? "sr-only" : "field__label"} htmlFor={htmlFor} id={`${htmlFor}-label`}>
      {children}
      {required ? <RequiredIndicator /> : null}
    </label>
  );
}

export function HelperText({ children, id }: { children: ReactNode; id: string }) {
  return <span className="field__helper" id={id}>{children}</span>;
}

export function FieldError({ children, id }: { children: ReactNode; id: string }) {
  return <span className="field__error" id={id} role="alert">{children}</span>;
}

export function FormField({
  id,
  label,
  labelHidden,
  helperText,
  error,
  required,
  disabled,
  readOnly,
  children
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className={cn("field", error && "field--invalid")}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      <FieldLabel hidden={labelHidden} htmlFor={fieldId} required={required}>{label}</FieldLabel>
      {children(fieldId, describedBy)}
      {helperText && helperId ? <HelperText id={helperId}>{helperText}</HelperText> : null}
      {error && errorId ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelHidden?: boolean;
  helperText?: string;
  error?: string;
}

export function Input({ label, labelHidden, helperText, error, required, className, id, disabled, readOnly, ...props }: InputProps) {
  return (
    <FormField disabled={disabled} error={error} helperText={helperText} id={id} label={label} labelHidden={labelHidden} readOnly={readOnly} required={required}>
      {(fieldId, describedBy) => (
        <input
          className={cn("input", className)}
          disabled={disabled}
          id={fieldId}
          readOnly={readOnly}
          required={required}
          {...props}
          aria-describedby={[props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : props["aria-invalid"]}
        />
      )}
    </FormField>
  );
}

export type PasswordInputProps = Omit<InputProps, "type">;

export function PasswordInput({ label, labelHidden, helperText, error, required, className, id, disabled, readOnly, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const actionLabel = visible ? "Ẩn mật khẩu" : "Hiển thị mật khẩu";
  return (
    <FormField disabled={disabled} error={error} helperText={helperText} id={id} label={label} labelHidden={labelHidden} readOnly={readOnly} required={required}>
      {(fieldId, describedBy) => (
        <span className="password-input">
          <input
            className={cn("input", className)}
            disabled={disabled}
            id={fieldId}
            readOnly={readOnly}
            required={required}
            type={visible ? "text" : "password"}
            {...props}
            aria-describedby={[props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined}
            aria-invalid={error ? true : props["aria-invalid"]}
          />
          <button
            aria-controls={fieldId}
            aria-label={actionLabel}
            aria-pressed={visible}
            className="password-input__toggle"
            disabled={disabled}
            onClick={() => setVisible((current) => !current)}
            onMouseDown={(event) => event.preventDefault()}
            title={actionLabel}
            type="button"
          >
            {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
          </button>
        </span>
      )}
    </FormField>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  labelHidden?: boolean;
  helperText?: string;
  error?: string;
}

export function Textarea({
  label,
  labelHidden,
  helperText,
  error,
  required,
  className,
  id,
  disabled,
  readOnly,
  ...props
}: TextareaProps) {
  return (
    <FormField disabled={disabled} error={error} helperText={helperText} id={id} label={label} labelHidden={labelHidden} readOnly={readOnly} required={required}>
      {(fieldId, describedBy) => (
        <textarea
          className={cn("textarea", className)}
          disabled={disabled}
          id={fieldId}
          readOnly={readOnly}
          required={required}
          {...props}
          aria-describedby={[props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : props["aria-invalid"]}
        />
      )}
    </FormField>
  );
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  labelHidden?: boolean;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  labelHidden,
  helperText,
  error,
  required,
  options,
  placeholder,
  className,
  id,
  disabled,
  ...props
}: SelectProps) {
  return (
    <FormField disabled={disabled} error={error} helperText={helperText} id={id} label={label} labelHidden={labelHidden} required={required}>
      {(fieldId, describedBy) => (
        <SelectControl
          className={cn("select", className)}
          disabled={disabled}
          id={fieldId}
          required={required}
          options={options}
          placeholder={placeholder}
          {...props}
          aria-describedby={[props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : props["aria-invalid"]}
        />
      )}
    </FormField>
  );
}

export interface ComboboxProps extends InputProps {
  options: SelectOption[];
}

export function Combobox({ options, label, labelHidden, helperText, error, required, className, id, disabled, readOnly, ...props }: ComboboxProps) {
  return (
    <FormField disabled={disabled} error={error} helperText={helperText} id={id} label={label} labelHidden={labelHidden} readOnly={readOnly} required={required}>
      {(fieldId, describedBy) => (
          <ComboboxControl
            className={cn("input", className)}
            disabled={disabled}
            id={fieldId}
            options={options}
            readOnly={readOnly}
            required={required}
            {...props}
            aria-describedby={[props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined}
            aria-invalid={error ? true : props["aria-invalid"]}
          />
      )}
    </FormField>
  );
}

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
}

export function Checkbox({ label, helperText, className, id, disabled, "aria-describedby": ariaDescribedBy, ...props }: CheckboxProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const describedBy = [ariaDescribedBy, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="choice-field" data-disabled={disabled || undefined} data-label-empty={!label || undefined}>
      <input aria-describedby={describedBy} className={cn("checkbox", className)} disabled={disabled} id={fieldId} type="checkbox" {...props} />
      <div className="choice-field__content">
        <label htmlFor={fieldId}>{label}</label>
        {helperText ? <small id={helperId}>{helperText}</small> : null}
      </div>
    </div>
  );
}

export interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
}

export function Radio({ label, helperText, className, id, disabled, "aria-describedby": ariaDescribedBy, ...props }: RadioProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const describedBy = [ariaDescribedBy, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="choice-field" data-disabled={disabled || undefined} data-label-empty={!label || undefined}>
      <input aria-describedby={describedBy} className={cn("radio", className)} disabled={disabled} id={fieldId} type="radio" {...props} />
      <div className="choice-field__content">
        <label htmlFor={fieldId}>{label}</label>
        {helperText ? <small id={helperId}>{helperText}</small> : null}
      </div>
    </div>
  );
}

export interface SwitchProps {
  label: string;
  checked: boolean;
  helperText?: string;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ label, checked, helperText, disabled, onCheckedChange }: SwitchProps) {
  const id = useId();
  const helperId = helperText ? `${id}-helper` : undefined;

  return (
    <div className="switch-field" data-disabled={disabled || undefined}>
      <button
        aria-checked={checked}
        aria-describedby={helperId}
        aria-labelledby={`${id}-label`}
        className={cn("switch", checked && "switch--checked")}
        disabled={disabled}
        id={id}
        onClick={() => onCheckedChange?.(!checked)}
        role="switch"
        type="button"
      >
        <span />
      </button>
      <div>
        <label className="switch-field__label" htmlFor={id} id={`${id}-label`}>
          {label}
        </label>
        {helperText ? <small id={helperId}>{helperText}</small> : null}
      </div>
    </div>
  );
}

export function DatePicker(props: Omit<InputProps, "type">) {
  return <Input type="date" {...props} />;
}

export const DateField = DatePicker;

export interface DateRangePickerProps {
  label: string;
  startLabel?: string;
  endLabel?: string;
}

export function DateRangePicker({
  label,
  startLabel = "Từ ngày",
  endLabel = "Đến ngày"
}: DateRangePickerProps) {
  return (
    <fieldset className="date-range">
      <legend>{label}</legend>
      <DatePicker label={startLabel} />
      <DatePicker label={endLabel} />
    </fieldset>
  );
}

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
  mobilePlaceholder?: string;
}

export function SearchInput({
  label = "Tìm kiếm",
  icon: Icon = Search,
  className,
  placeholder,
  mobilePlaceholder = "Tìm kiếm",
  ...props
}: SearchInputProps) {
  const phone = useIsPhone();
  return (
    <div className="search-input" data-ui="search-input">
      <Icon aria-hidden="true" size={18} />
        <input aria-label={label} className={cn("input", className)} type="search" {...props} placeholder={phone ? mobilePlaceholder : placeholder ?? "Tìm kiếm"} />
    </div>
  );
}
