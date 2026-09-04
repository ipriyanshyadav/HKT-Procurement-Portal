"use client";

import React, { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { Search } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...rest }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="apple-label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`apple-input ${error ? '!border-red-500 !ring-1 !ring-red-500/20' : ''} ${className}`}
          {...rest}
        />
        {error && <p className="text-xs text-red-500 mt-1.5 font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-neutral-400 mt-1.5">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (val: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = '', placeholder = 'Search...', onChange, onSearch, ...rest }, ref) => {
    return (
      <div className="apple-search-wrap">
        <Search className="search-icon w-4 h-4" />
        <input
          ref={ref}
          type="search"
          placeholder={placeholder}
          className={`apple-input ${className}`}
          onChange={(e) => {
            onChange?.(e);
            onSearch?.(e.target.value);
          }}
          {...rest}
        />
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string | number; label: string }[];
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, children, className = '', id, ...rest }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="apple-label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`apple-select ${error ? '!border-red-500' : ''} ${className}`}
          {...rest}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, rows = 3, ...rest }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="apple-label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`apple-input resize-none ${error ? '!border-red-500' : ''} ${className}`}
          {...rest}
        />
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
