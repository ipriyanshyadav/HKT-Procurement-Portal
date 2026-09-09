"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ContractRedlineStudio } from "@procurement/ui";
import { useContract } from "@procurement/hooks";

export default function ContractRedlinePage() {
  const params = useParams();
  const contractId = params.id as string;
  const { data: contract } = useContract(contractId);

  return (
    <ContractRedlineStudio
      contractId={contractId}
      contractNumber={contract?.contract_number}
      contractTitle={contract?.title}
      userRole="BUYER"
      currentUserEmail="buyer@procurement.com"
    />
  );
}
