"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/**
 * Client island that organizes the (server-rendered) alumni-profile panels under
 * secondary-nav tabs, breaking the long single-column scroll into Overview /
 * Interactions / Education / Tasks.
 *
 * Every panel is built on the server with the already-fetched profile data and
 * passed in as a `ReactNode` prop — no data fetching, role gating, or business
 * logic moves into the client. Tabs that have no content for the current record
 * (e.g. Tasks for a non-editor, or empty Education) are omitted so the bar only
 * shows meaningful destinations.
 */
export function AlumniProfileTabs({
  overview,
  interactions,
  notes,
  events,
  surveys,
  employment,
  education,
  designations,
  engagement,
  tasks,
  profileCompleteness,
  payItForward,
}: {
  overview: ReactNode;
  interactions: ReactNode;
  /** Unified notes timeline — its own tab. Shown to every role (writing is
   *  gated server-side); the panel renders its own empty state. */
  notes: ReactNode;
  /** Recent events / attendance — its own tab. Pass undefined when the alumnus
   *  has no events and the viewer can't add them, and the tab is hidden. */
  events?: ReactNode;
  /** Survey tracking history — its own tab. Pass undefined when the alumnus has
   *  no surveys on file, and the tab is hidden. */
  surveys?: ReactNode;
  /** Employment history — its own tab. */
  employment: ReactNode;
  education?: ReactNode;
  /** Other designations + certifications (CFA/CFP/CPA) — its own tab. Renders
   *  its own empty state, so it's shown to every role when passed. */
  designations?: ReactNode;
  /** Editor-only — pass undefined for view-only roles and the tab is hidden. */
  engagement?: ReactNode;
  tasks?: ReactNode;
  /** Profile-completeness checklist — capability-gated tab. Pass undefined when
   *  the viewer lacks the `profile.completeness` capability and the tab hides. */
  profileCompleteness?: ReactNode;
  /** Pay It Forward giving — pass undefined when the alumnus has no donations,
   *  and the tab is hidden. Shown to every role when present (amounts gated). */
  payItForward?: ReactNode;
}) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="interactions">Interactions</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        {events ? <TabsTrigger value="events">Events</TabsTrigger> : null}
        {surveys ? (
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
        ) : null}
        <TabsTrigger value="employment">Employment</TabsTrigger>
        {education ? (
          <TabsTrigger value="education">Education</TabsTrigger>
        ) : null}
        {designations ? (
          <TabsTrigger value="designations">Designations</TabsTrigger>
        ) : null}
        {engagement ? (
          <TabsTrigger value="engagement">Tags</TabsTrigger>
        ) : null}
        {tasks ? <TabsTrigger value="tasks">Tasks</TabsTrigger> : null}
        {profileCompleteness ? (
          <TabsTrigger value="completeness">Completeness</TabsTrigger>
        ) : null}
        {payItForward ? (
          <TabsTrigger value="pay-it-forward">Pay it forward</TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="interactions">{interactions}</TabsContent>
      <TabsContent value="notes">{notes}</TabsContent>
      {events ? <TabsContent value="events">{events}</TabsContent> : null}
      {surveys ? (
        <TabsContent value="surveys">{surveys}</TabsContent>
      ) : null}
      <TabsContent value="employment">{employment}</TabsContent>
      {education ? (
        <TabsContent value="education">{education}</TabsContent>
      ) : null}
      {designations ? (
        <TabsContent value="designations">{designations}</TabsContent>
      ) : null}
      {engagement ? (
        <TabsContent value="engagement">{engagement}</TabsContent>
      ) : null}
      {tasks ? <TabsContent value="tasks">{tasks}</TabsContent> : null}
      {profileCompleteness ? (
        <TabsContent value="completeness">{profileCompleteness}</TabsContent>
      ) : null}
      {payItForward ? (
        <TabsContent value="pay-it-forward">{payItForward}</TabsContent>
      ) : null}
    </Tabs>
  );
}
