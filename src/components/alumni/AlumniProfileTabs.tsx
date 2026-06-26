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
  education,
  engagement,
  tasks,
}: {
  overview: ReactNode;
  interactions: ReactNode;
  education?: ReactNode;
  /** Editor-only — pass undefined for view-only roles and the tab is hidden. */
  engagement?: ReactNode;
  tasks?: ReactNode;
}) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="interactions">Interactions</TabsTrigger>
        {education ? (
          <TabsTrigger value="education">Education</TabsTrigger>
        ) : null}
        {engagement ? (
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        ) : null}
        {tasks ? <TabsTrigger value="tasks">Tasks</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="interactions">{interactions}</TabsContent>
      {education ? (
        <TabsContent value="education">{education}</TabsContent>
      ) : null}
      {engagement ? (
        <TabsContent value="engagement">{engagement}</TabsContent>
      ) : null}
      {tasks ? <TabsContent value="tasks">{tasks}</TabsContent> : null}
    </Tabs>
  );
}
