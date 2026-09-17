import React, { useState } from 'react';
import { Search, Filter, Mail, Calendar, User, Sparkles, ChevronDown } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

export const EmailList = ({ 
  emails, 
  selectedIds, 
  setSelectedIds, 
  onEmailClick, 
  onBulkSummarize,
  isLoading,
  labelFilter,
  setLabelFilter,
  searchQuery,
  setSearchQuery
}) => {

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(emails.map(email => email.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleCheckboxChange = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email threads..."
            className="w-full bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 backdrop-blur-md rounded-xl pl-10 pr-4 py-2 text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 font-sans placeholder-stone-400 dark:placeholder-stone-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
          <div className="relative flex items-center">
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="bg-white/40 dark:bg-stone-800/40 border border-white/50 dark:border-stone-700 backdrop-blur-md text-stone-800 dark:text-stone-200 text-xs rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-beige-400 dark:focus:border-stone-500 cursor-pointer appearance-none"
            >
              <option value="INBOX" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Inbox</option>
              <option value="UNREAD" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Unread</option>
              <option value="STARRED" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Starred</option>
              <option value="SENT" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Sent</option>
              <option value="SPAM" className="bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200">Spam</option>
            </select>
            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-stone-500 dark:text-stone-400 pointer-events-none" />
          </div>

          <button
            onClick={onBulkSummarize}
            disabled={selectedIds.length === 0 || isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-beige-400 to-beige-600 hover:from-beige-300 hover:to-beige-500 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-[0_4px_12px_rgba(168,152,120,0.2)] shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>Summarize Selected ({selectedIds.length})</span>
          </button>
        </div>
      </div>

      {/* Header Select All row */}
      <div className="flex items-center px-4 py-2 border-b border-stone-200 dark:border-stone-700 text-[10px] font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono bg-stone-100/50 dark:bg-stone-800/50 shrink-0">
        <input 
          type="checkbox" 
          onChange={handleSelectAll} 
          checked={emails.length > 0 && selectedIds.length === emails.length} 
          className="mr-4 rounded border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-beige-600 focus:ring-beige-400 h-3.5 w-3.5"
        />
        <div className="flex-1 grid grid-cols-12 gap-2">
          <div className="col-span-3">Sender</div>
          <div className="col-span-7">Subject & Details</div>
          <div className="col-span-2 text-right">Date</div>
        </div>
      </div>

      {/* List Rows */}
      <div className="flex-1 overflow-y-auto pr-1 divide-y divide-stone-100 dark:divide-stone-800">
        {emails.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-stone-400 dark:text-stone-500 font-sans text-xs text-center p-6">
            <Mail className="h-8 w-8 mb-2 opacity-25" />
            <span>No emails found in this category</span>
          </div>
        ) : (
          emails.map((email) => {
            const isChecked = selectedIds.includes(email.id);
            const cleanDate = email.date ? email.date.split(',')[1]?.trim() || email.date : '';

            return (
              <div 
                key={email.id}
                className={`flex items-start px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors cursor-pointer text-xs ${isChecked ? 'bg-beige-150/50 dark:bg-stone-800/80' : ''}`}
                onClick={() => onEmailClick(email)}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCheckboxChange(email.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mr-4 mt-0.5 rounded border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-beige-600 focus:ring-beige-400 h-3.5 w-3.5"
                />

                <div className="flex-1 grid grid-cols-12 gap-2 text-stone-700 dark:text-stone-300">
                  {/* Sender */}
                  <div className="col-span-3 font-semibold text-stone-800 dark:text-stone-200 truncate flex items-center gap-1.5 pr-2">
                    <User className="h-3 w-3 text-stone-400 dark:text-stone-500 shrink-0" />
                    <span className="truncate">{email.sender ? email.sender.split('<')[0]?.trim() || email.sender : ''}</span>
                  </div>

                  {/* Subject and Snippet */}
                  <div className="col-span-7 flex flex-col gap-0.5 pr-2">
                    <span className="font-bold text-stone-900 dark:text-stone-100 truncate">{email.subject}</span>
                    <span className="text-stone-500 dark:text-stone-400 truncate text-[11px] font-sans">{email.snippet}</span>
                  </div>

                  {/* Date */}
                  <div className="col-span-2 text-right text-stone-500 dark:text-stone-400 font-mono text-[10px] flex items-center justify-end gap-1.5">
                    <Calendar className="h-3 w-3 text-stone-400 dark:text-stone-500 shrink-0" />
                    <span>{cleanDate.split(' ')[0] || email.date}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default EmailList;
