"use client";

import { Suspense } from "react";
import { RoomBooking } from "./room-booking";

export default function RoomBookingPage() {
  return (
    <Suspense fallback={null}>
      <RoomBooking />
    </Suspense>
  );
}
