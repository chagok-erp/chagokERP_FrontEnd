/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ErpProvider, useErp } from './context/ErpContext';
import { AppShell } from './components/common/AppShell';
import { LoginScreen } from './components/screens/LoginScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { AssistantScreen } from './components/screens/AssistantScreen';
import { MaterialsScreen } from './components/screens/MaterialsScreen';
import { SuppliersScreen } from './components/screens/SuppliersScreen';
import { WarehousesScreen } from './components/screens/WarehousesScreen';
import { PrScreen } from './components/screens/PrScreen';
import { ApprovalsScreen } from './components/screens/ApprovalsScreen';
import { PoScreen } from './components/screens/PoScreen';
import { GrScreen } from './components/screens/GrScreen';
import { InventoryScreen } from './components/screens/InventoryScreen';

const ErpWorkspace: React.FC = () => {
  const { currentUser, activeScreen } = useErp();

  if (!currentUser) {
    return <LoginScreen />;
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'assistant':
        return <AssistantScreen />;
      case 'materials':
        return <MaterialsScreen />;
      case 'suppliers':
        return <SuppliersScreen />;
      case 'warehouses':
        return <WarehousesScreen />;
      case 'pr':
        return <PrScreen />;
      case 'approvals':
        return <ApprovalsScreen />;
      case 'po':
        return <PoScreen />;
      case 'gr':
        return <GrScreen />;
      case 'inventory':
        return <InventoryScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return <AppShell>{renderScreen()}</AppShell>;
};

export default function App() {
  return (
    <ErpProvider>
      <ErpWorkspace />
    </ErpProvider>
  );
}
