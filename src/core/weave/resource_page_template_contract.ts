import type { ResourcePageDocumentModel } from "./resource_page_models.ts";

export type ResourcePageTemplateRole = "outer" | "inner";

export interface ResourcePageTemplateDescriptor {
  readonly iri: string;
  readonly role: ResourcePageTemplateRole;
}

export interface ResourcePageTemplateRenderRequest {
  readonly document: ResourcePageDocumentModel;
  readonly template: ResourcePageTemplateDescriptor;
}

export type ResourcePageTemplateSlot =
  | "head"
  | "shell"
  | "masthead"
  | "body"
  | "panels"
  | "footer";

export interface ResourcePageTemplateFragment {
  readonly slot: ResourcePageTemplateSlot;
  readonly html: string;
}

export interface ResourcePageTemplatePageHtmlResult {
  readonly kind: "pageHtml";
  readonly html: string;
}

export interface ResourcePageTemplateFragmentsResult {
  readonly kind: "fragments";
  readonly fragments: readonly ResourcePageTemplateFragment[];
}

export type ResourcePageTemplateRenderResult =
  | ResourcePageTemplatePageHtmlResult
  | ResourcePageTemplateFragmentsResult;
