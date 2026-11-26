/**
 * Versioned configuration: samplingTables, questionnaires. (Holiday calendars were removed: decision 54.)
 * A published version is never edited: a new draft version is created instead.
 */
import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { CONFIG_STATUSES, LANGUAGES, MODULES, TRANSLATION_STATUSES } from '@smartaudit/shared';

const versioned = {
  version: { type: Number, required: true },
  status: { type: String, enum: CONFIG_STATUSES, required: true, default: 'draft' },
  publishedAt: { type: Date, default: null },
  publishedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: null },
};

const samplingTableSchema = new Schema(
  {
    ...versioned,
    brackets: [
      {
        _id: false,
        min: { type: Number, required: true },
        max: { type: Number, default: null },
        required: { type: Number, required: true },
        rangeMax: { type: Number, default: null },
      },
    ],
  },
  { timestamps: true, collection: 'samplingTables' },
);
samplingTableSchema.index({ version: 1 }, { unique: true });
export type SamplingTableDoc = InferSchemaType<typeof samplingTableSchema> & { _id: Types.ObjectId };
export const SamplingTable = model('SamplingTable', samplingTableSchema);

const questionnaireSchema = new Schema(
  {
    ...versioned,
    module: { type: String, enum: MODULES, required: true },
    title: { type: String, default: null },
    /** Revision of the seed file it includes (`revision` in seed/data); copies keep it. 2 = conversational. */
    seedRevision: { type: Number, default: 1 },
    languages: [
      {
        _id: false,
        lang: { type: String, enum: LANGUAGES, required: true },
        status: { type: String, enum: TRANSLATION_STATUSES, required: true },
        approvedAt: { type: Date, default: null },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
    /** Question structure validated with Zod (`questionSchema`) before saving. */
    questions: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, collection: 'questionnaires' },
);
questionnaireSchema.index({ module: 1, version: 1 }, { unique: true });
export type QuestionnaireDoc = InferSchemaType<typeof questionnaireSchema> & { _id: Types.ObjectId };
export const Questionnaire = model('Questionnaire', questionnaireSchema);
