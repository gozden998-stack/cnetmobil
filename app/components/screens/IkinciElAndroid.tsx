"use client";

import React from "react";
import IkinciElFiyatListesi from "./IkinciElFiyatListesi";

type Props = {
  data: any[][];
  canEdit?: boolean;
  onEdit?: () => void;
};

export default function IkinciElAndroid(props: Props) {
  return <IkinciElFiyatListesi {...props} type="android" />;
}
