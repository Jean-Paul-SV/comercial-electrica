export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export type OnboardingChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export type OnboardingStatusResponse = {
  status: OnboardingStatus;
  step: 1 | 2 | 3;
  hasOpenCashSession: boolean;
  hasAtLeastOneProduct: boolean;
  checklist: OnboardingChecklistItem[];
};
