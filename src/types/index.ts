export interface Tab {
  current_url: string;
  last_updated: string;
  verb_cache?: Record<string, Verb>;
  verb_cache_expires?: string;
  execution_plan_cache?: Record<string, ExecutionPlan>;
}

export interface Verb {
  name: string;
  description: string;
  type: 'navigate' | 'form' | 'action';
  params?: string[];
  target?: string; // URL, selector, etc.
  subverbs?: Verb[]; // Optional: for grouping similar verbs (namespacing)
}

export interface ExecutionPlan {
  method: 'navigate' | 'form' | 'action';
  target_url?: string;
  command?: string; // links command to execute
  description: string;
}

export interface TabsState {
  [name: string]: Tab;
}
