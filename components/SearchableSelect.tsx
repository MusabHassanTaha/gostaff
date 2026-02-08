import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string | string[] | undefined;
  onChange: (value: any) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isMulti?: boolean;
  clearable?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'اختر...',
  className = '',
  disabled = false,
  isMulti = false,
  clearable = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize value to array for multi mode, or single item for single mode logic
  const selectedValues = useMemo(() => {
    if (isMulti) {
        return Array.isArray(value) ? value : (value ? [value] : []);
    }
    return value;
  }, [value, isMulti]);

  const selectedOptions = useMemo(() => {
      if (isMulti) {
          const vals = selectedValues as string[];
          return options.filter(opt => vals.includes(opt.value));
      }
      return options.find(opt => opt.value === value);
  }, [selectedValues, value, isMulti, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(lower)
    );
  }, [options, searchTerm]);

  const handleSelect = (val: string | undefined) => {
    if (isMulti) {
        if (!val) {
             // Clear all
             onChange([]);
             return;
        }
        const current = (selectedValues as string[]) || [];
        const exists = current.includes(val);
        let next: string[];
        if (exists) {
            next = current.filter(v => v !== val);
        } else {
            next = [...current, val];
        }
        onChange(next);
        // Keep open for multi select
    } else {
        onChange(val);
        setIsOpen(false);
    }
  };

  const removeValue = (e: React.MouseEvent, valToRemove: string) => {
      e.stopPropagation();
      if (isMulti) {
          const current = (selectedValues as string[]) || [];
          onChange(current.filter(v => v !== valToRemove));
      } else {
          onChange(undefined);
      }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border rounded-lg flex items-center justify-between cursor-pointer bg-white transition-all min-h-[46px] ${
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 
          isOpen ? 'ring-2 ring-primary/20 border-primary' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 overflow-hidden">
            {!isMulti ? (
                <span className={`block truncate ${(selectedOptions as Option)?.label ? 'text-gray-900' : 'text-gray-500'}`}>
                    {(selectedOptions as Option)?.label || placeholder}
                </span>
            ) : (
                (selectedOptions as Option[]).length > 0 ? (
                    (selectedOptions as Option[]).map(opt => (
                        <span key={opt.value} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-sm max-w-full">
                            <span className="truncate max-w-[150px]">{opt.label}</span>
                            <X 
                                className="w-3 h-3 cursor-pointer hover:bg-primary/20 rounded-full" 
                                onClick={(e) => removeValue(e, opt.value)}
                            />
                        </span>
                    ))
                ) : (
                    <span className="text-gray-500">{placeholder}</span>
                )
            )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full min-w-[350px] mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-[400px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                className="w-full pl-3 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                placeholder="بحث..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {!isMulti && clearable && (
                <div 
                className={`px-4 py-3 text-sm rounded-lg cursor-pointer transition-all mb-1 font-bold ${!value ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                onClick={() => handleSelect(undefined)}
                >
                {placeholder} (الكل/بدون)
                </div>
            )}
            
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400 font-bold">
                لا توجد نتائج
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = isMulti 
                    ? (selectedValues as string[]).includes(opt.value)
                    : value === opt.value;
                
                return (
                    <div
                    key={opt.value}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    className={`px-4 py-3 text-sm rounded-lg transition-all flex items-center justify-between mb-1 font-bold ${
                        opt.disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 
                        isSelected ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                    }`}
                    >
                    <span>{opt.label}</span>
                    {isSelected && !opt.disabled && (
                        isMulti ? <Check className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                    </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
