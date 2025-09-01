import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  onConfirm,
  onCancel,
  isDestructive = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-800/95 backdrop-blur-lg border border-slate-600/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-200 scale-100 opacity-100">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
              isDestructive 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {isDestructive ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
          </div>
          
          {/* Message */}
          <p className="text-slate-300 mb-6 leading-relaxed">
            {message}
          </p>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 sm:justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 hover:border-slate-500/50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-500/50 order-2 sm:order-1"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2.5 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 order-1 sm:order-2 ${
                isDestructive
                  ? 'text-white bg-red-600 hover:bg-red-500 border border-red-500/50 hover:border-red-400/50 focus:ring-red-500/50'
                  : 'text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/50 hover:border-blue-400/50 focus:ring-blue-500/50'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
