export type ApiValidationIssue = {
  path?: Array<string | number>;
  message?: string;
  code?: string;
};

export type ApiValidationDetails = {
  issues?: ApiValidationIssue[];
  fieldErrors?: Record<string, string[]>;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiValidationDetails | ApiValidationIssue[] | unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
