/**
 * Versioned configuration: samplingTables, holidayCalendars, questionnaires.
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

const holidayCalendarSchema = new Schema(
  {
    ...versioned,
    country: { type: String, required: true },
    year: { type: Number, required: true },
    /** Dates from `date-holidays` at generation time. */
    officialDates: { type: [String], default: [] },
    overrides: {
      add: { type: [String], default: [] },
      remove: { type: [String], default: [] },
    },
    /** Effective list = official ± overrides. */
    dates: { type: [String], default: [] },
    source: { type: String, default: 'date-holidays' },
  },
  { timestamps: true, collection: 'holidayCalendars' },
);
holidayCalendarSchema.index({ country: 1, year: 1, version: 1 }, { unique: true });
export type HolidayCalendarDoc = InferSchemaType<typeof holidayCalendarSchema> & { _id: Types.ObjectId };
export const HolidayCalendar = model('HolidayCalendar', holidayCalendarSchema);

const questionnaireSchema = new Schema(
  {
    ...versioned,
    module: { type: String, enum: MODULES, required: true },
    title: { type: String, default: null },
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
