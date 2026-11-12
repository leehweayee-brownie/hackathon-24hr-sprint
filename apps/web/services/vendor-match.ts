import type { BriefParseResult, DocType, MatchResult, TenderRequirements, VendorCheckView } from '@vp/shared';
import { post } from './http';

export const vendorMatchService = {
  /** Text (pasted, or quick fields joined) and/or an RFQ file. */
  brief: (input: { text?: string; file?: File | null }) => {
    if (input.file) {
      const form = new FormData();
      if (input.text) form.append('text', input.text);
      form.append('file', input.file);
      return post<BriefParseResult>('/vendor-match/brief', form, { timeout: 120_000 });
    }
    return post<BriefParseResult>('/vendor-match/brief', { text: input.text }, { timeout: 120_000 });
  },
  shortlist: (requirements: TenderRequirements) => post<MatchResult>('/vendor-match/shortlist', { requirements }),
  invite: (supplierId: string, requirements: TenderRequirements) => post<VendorCheckView>('/vendor-match/invite', { supplierId, requirements }),
  requestDocuments: (supplierId: string, requirements: TenderRequirements, docTypes: DocType[], note?: string) =>
    post<VendorCheckView>('/vendor-match/request-documents', { supplierId, requirements, docTypes, note }),
};
