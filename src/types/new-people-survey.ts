/**
 * The api#661 "new people" survey types: thin aliases over the generated
 * backend schema (`api.gen.ts`), so every call site is checked against the
 * real contract. A backend rename becomes a typecheck failure here.
 */
import type { Schema } from "@/types/api";

/** Which path the respondent picked on the first question. */
export type NewPersonKind = Schema<"NewPersonSubmitRequest">["kind"];

export type NewPeopleRequiredFields = Schema<"NewPeopleRequiredFields">;
export type NewPeopleSurveyInfo = Schema<"NewPeopleSurveyInfo">;
export type NewPersonSubmitRequest = Schema<"NewPersonSubmitRequest">;
export type NewPersonSubmitResult = Schema<"NewPersonSubmitResult">;
export type NewPeopleLinkRead = Schema<"NewPeopleLinkRead">;
export type NewPersonPossibleMatch = Schema<"NewPersonPossibleMatch">;
export type NewPersonSubmissionItem = Schema<"NewPersonSubmissionItem">;
export type NewPersonApproveRequest = Schema<"NewPersonApproveRequest">;
export type NewPersonApproveResult = Schema<"NewPersonApproveResult">;
export type NewPersonMergePreview = Schema<"NewPersonMergePreview">;
export type NewPersonBulkRejectRequest = Schema<"NewPeopleBulkRejectRequest">;
export type NewPersonBulkRejectResult = Schema<"NewPeopleBulkRejectResult">;
export type NewPeopleInviteRequest = Schema<"NewPeopleInviteRequest">;
export type NewPeopleInviteResult = Schema<"NewPeopleInviteResult">;
export type NewPeopleInviteSkipReason = NewPeopleInviteResult["skipped"][number]["reason"];
