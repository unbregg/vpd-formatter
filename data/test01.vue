<template lang="pug">
PromsLayout.budget-list
  div(slot="title") 我的预测
  div(slot="op")
    Button(
      type="primary",
      :to="{ name: 'proms-budgets-create' }",
      v-if="createAllowed"
    ) 发起
  div(slot="content")
    PromsCollapse
      div(slot="panel")
        .query-container
          PromsBudgetSelector(v-model="query.budget")
          Button.submit-btn(@click="handleQueryClick") 查询
        Table(
          border,
          :columns="columns",
          :data="budgetList",
          :loading="budgetLoading"
        )
          template(slot-scope="{ row, index }", slot="index") {{ index + 1 }}
          template(slot-scope="{ row, index }", slot="handleTime") {{ row.gmtModified | moment('YYYY-MM-DD HH:mm:ss') }}
          template(slot-scope="{row, index}", slot="desc")
            span(style="white-space: pre-wrap;") {{ row.desc }}
          template(slot-scope="{row, index}", slot="status") {{ row.newApprove ? NEW_BUDGET_STATUS_DESC_MAP[row.budgetStatus] : BUDGET_STATUS_DESC_MAP[row.budgetStatus] }}
          .op-wrapper(slot-scope="{ row, index }", slot="op")
            .op(v-if="row.ops.some((op) => op === BudgetOp.UPDATE)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-update', params: { id: row.id } })"
              ) 发起内容调整
            .op(v-if="row.ops.some((op) => op === BudgetOp.CONFIG)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-config', params: { id: row.id } })"
              ) 配置
            .op(v-if="row.ops.some((op) => op === BudgetOp.VIEW)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-view', params: { id: row.id } })"
              ) 查看配置
            .op(v-if="row.ops.some((op) => op === BudgetOp.ADJUST)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-adjust', params: { id: row.id } })"
              ) 调整
            .op(v-if="row.ops.some((op) => op === BudgetOp.PROGRESS)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-progress', params: { id: row.id } })"
              ) 查看进度
            .op(v-if="row.ops.some((op) => op === BudgetOp.LOCK)")
              a(href="javascript:void(0);", @click="handleLock(row)") 锁定
            .op(v-if="row.ops.some((op) => op === BudgetOp.CHECK)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-check', params: { id: row.id } })"
              ) 预算审批
            .op(v-if="row.ops.some((op) => op === BudgetOp.LOCK_CHECK)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-view', params: { id: row.id } })"
              ) 锁量审批
            .op(v-if="row.ops.some((op) => op === BudgetOp.COMPARE)")
              a(
                href="javascript:void(0);",
                @click="$router.push({ name: 'proms-budgets-comparison', params: { id: row.id } })"
              ) 版本对比
            .op(v-if="row.ops.some((op) => op === BudgetOp.DELETE)")
              a(href="javascript:void(0);", @click="handleDelete(row)") 删除
        .pager-container
          Page(
            :total="pager.total",
            :page-size="pager.pageSize",
            :current.sync="pager.current",
            @on-change="doQuery"
          )
</template>
<script lang="ts">
// @ts-nocheck
import Vue from 'vue';
import Component from 'vue-class-component';
import { mapState, mapActions } from 'vuex';
import qs from 'qs';
import moment from 'moment';
import { debounce, get } from 'lodash';
import { DataCell, sort, groupDataByProp } from '@/pages/proms/services/dataService';
import axios from '@/pages/proms/services/apiService';
import { downloadExcelByFileBuffer } from '@/pages/proms/services/exportService';
import { TGROUP_ORDER } from '@/pages/proms/types/order';
import PromsModel, { Biz, TimeGranularity, BudgetOp, PreBusiStatusEnum, AuditResult } from '@/typings/models/proms.d.ts';
import api from '@/pages/proms/api';
import { BUSI_STATUS_DESC_MAP } from '@/pages/proms/constant';
import { filterHttpSuccessErrors } from '@/utils';
import MonthForecastCard from '../config-budget/MonthForecastCard.vue';
import DayForecastCard from '../config-budget/DayForecastCard.vue';
import ForecastChartPart from '../config-budget/ForecastChartPart.vue';
import TitleCollapse from '../config-budget/TitleCollapse.vue';
import ForecastConcludPart from '../config-budget/ForecastConcludPart.vue';
import CTargetCard from '../config-budget/TargetCard.vue';
import { BizData, TargetCard } from '../CheckBudget/store';
import './store';

const GROUP_ORDER = {
  '服务量': 1,
  'PROD': 2,
};

function aggBizDateCellList(list: DataCell[]): {}[] {
  return groupDataByProp({ data: list,
    prop: [ // bizData传入 传入$target里的字段
      {
        props: ['$target.groupName', '$target.groupId'],
        compare(item1, item2) {
          const order1 = GROUP_ORDER[get(item1, '$target.groupName')] || 999999;
          const order2 = GROUP_ORDER[get(item2, '$target.groupName')] || 999999;
          return order1 - order2 > 0;
        },
      },
      {
        props: ['$target.id', '$target.targetTypeName', '$target.targetTypeId', '$target.sort', '$target.visible', '$target.editable', '$target.planId', '$target.planName', '$target.planTypeConfigurable'],
        compare(item1, item2) {
          const order1 = get(item1, '$target.sort') || 999999;
          const order2 = get(item2, '$target.sort') || 999999;
          return order1 - order2 > 0;
        },
      },
    ] });
}

@Component({
  components: { TargetCard: CTargetCard, MonthForecastCard, DayForecastCard, TitleCollapse, ForecastChartPart, ForecastConcludPart },
  data() {
    return {
      name1(){},
      name2: '',
      name3: 123,
      name4: function() {

      }
    }
  },
  props: {
    color1: String,
    color2: [String, Number],
    color3: {
      type: String,
      default: () => '#fff',
    },
    color4: {
      type: String,
      default: 'white'
    }
  },
  computed: {
    ...mapState('PROMS_BUDGETS/CONFIG_BUDGET', [
      'budgetDetail',
      'showPage',
      'mode',
      'topQuery',
      'bizDataList',
      'models',
      'isApprovalProcess',
    ]),
  },
  methods: {
    ...mapActions('PROMS_BUDGETS/CONFIG_BUDGET', [
      'fetchBudgetDetail',
      'fetchBizData',
      'fetchPlanTypeEnums',
      'updateTopQuery',
      'saveBudgetConfig',
      'submitBudgetConfig',
      'calcAndRefreshDizData',
    ]),
    ...mapActions("PROMS_BUDGETS/BUDGET_LIST", ["updateQuery", "doQuery"]),
    getClolor() {

    },
    getName: function() {}
  },
  watch: {
    dataFilter(newVal, oldVal) {
        if (JSON.stringify(newVal) === JSON.stringify(oldVal)) return;
        this.fetchChartData(this);
     },
    series: function(val) {
      drawChart(this.$refs.container, { series: this.series, dim: this.dim, budget: this.baseBudgetDetail });
    },
    $route: {
      immediate: true,
      handler() {
        this.fetchBudgetDetail();
      },
    },
  },
})
export default class ConfigBudget extends Vue {
  BudgetOp: any = BudgetOp;
  moment: any = moment;
  TimeGranularity: any = TimeGranularity;
  biz: {bg: Biz[]; bu: Biz[]; biz: Biz[]} = { bg: [], bu: [], biz: [] };
  activeGroupIndex = null;
  activeIndex = '电话'; // 月度和日度的tab序号
  configDate: Date = null;
  monthCollapse = true
  dayCollapse = true
  allTargetList = [] // 全量指标列表 供月度预测/时段预测趋势图的指标筛选
  groupTargetList = {} // 分组指标列表
  groupPlanList = {}
  TGROUP_ORDER: any = TGROUP_ORDER
  lockRejectModal = false
  lockRejectReason = ''
  selectedBizId = ''
  // 当前的预测配置信息
  curPreConfigInfo: PromsModel.PreConfigInfo = null
  PreBusiStatusEnum = PreBusiStatusEnum;
  BUSI_STATUS_DESC_MAP = BUSI_STATUS_DESC_MAP;
  AuditResult = AuditResult;

  get timeRangeConfig() {
    return {
      disabledDate: (date: Date) => {
        const dataTime = date.getTime();
        const startDate = (this as any).budgetDetail.startdate;
        const endDate = (this as any).budgetDetail.enddate;
        return dataTime < startDate || dataTime > endDate;
      },
    };
  }
  changeMonthCollapse (val) {
    this.monthCollapse = val;
  }
  changeDayCollapse (val) {
    this.dayCollapse = val;
  }
  selectAll () {
    this.selectTarget = this.targetList.map((item) => { return item.targetTypeId; });
  }
  getGroupData (index) { // 点击tab获取该组下的数据，已经点过的不重复获取
    if (typeof this.getBizData(this.biz.biz[0]).dataCellList.find((val) => { return val.$target.groupName === index; }) === 'undefined') {
      const groupId = this.divideTargetList(this.getBizData(this.biz.biz[0]).targetList).find((item) => { return item.$target.groupName === index; }).$target.groupId;
      (this as any).fetchBizData({ biz: this.biz.biz[0], type: 1, groupId: groupId });
    }
  }
  divideTargetList (val) {
    const groupObj = {};
    const groupArr = [];
    val.forEach((item) => {
      if (item.visible === 1) {
        if (typeof groupObj[item.groupName] === 'undefined') {
          groupObj[item.groupName] = [];
          groupArr.push({
            $target: {
              groupName: item.groupName,
              groupId: item.groupId,
            },
            children: [],
          });
        }
        groupObj[item.groupName].push(item);
        groupArr.find((i) => { return i.$target.groupName === item.groupName; }).children.push(item);
      }
    });
    for (const item of groupArr) { // 指标排序
      item.children.sort(this.compareUp('sort'));
    }
    groupArr.sort(this.compareGroupUp('groupName'));
    const groupPlanArr = [];
    groupArr.forEach((item) => {
      const planArr = [];
      groupPlanArr.push({
        $target: item.$target,
        children: planArr,
      });
      const planObj = {};
      item.children.forEach((val) => {
        if (val.planName !== '') {
          if (typeof planObj[val.planId] === 'undefined') {
            planObj[val.planId] = val.planId;
            planArr.push({
              $target: {
                planId: val.planId,
                planName: val.planName,
              },
              children: [],
            });
          }
          planArr.find((j) => { return j.$target.planId === val.planId; }).children.push(val);
        }
      });
    });
    return groupPlanArr; // 该组下的所有target 组名：[{}]
  }
  divideGroupPlanList (val) {
    const groupObj = this.divideGroupTargetList(val);
    const groupPlanObj = {};
    for (const item in groupObj) {
      const planObj = {};
      groupObj[item].forEach((val) => {
        if (typeof planObj[val.planName] === 'undefined') {
          if (val.planName !== '') { // 方案名为空格的不要 是异常
            planObj[val.planName] = val.planName;
          }
        }
      });
      groupPlanObj[item] = Object.keys(planObj);
    }
    return groupPlanObj; // 该组下的所有plan 组名：[]
  }
}
</script>
<style lang="scss" scoped>
.budget-list {
  .query-container {
    display: flex;
    flex-wrap: wrap;
    > * {
      margin-bottom: 16px;
    }
    .submit-btn {
      margin-left: 48px;
    }
  }
  .op-wrapper {
    display: flex;
    .op {
      padding: 0 6px;
      &:not(:last-child) {
        border-right: 1px solid #eee;
      }
      a {
        color: #1790ff;
      }
    }
  }
  .pager-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
.lock-modal-content {
  text-align: center;
  font-size: 16px;
}
</style>
<style lang="scss" scoped>
.budget-list {
  .query-container {
    display: flex;
    flex-wrap: wrap;
    > * {
      margin-bottom: 16px;
    }
    .submit-btn {
      margin-left: 48px;
    }
  }
  .op-wrapper {
    display: flex;
    .op {
      padding: 0 6px;
      &:not(:last-child) {
        border-right: 1px solid #eee;
      }
      a {
        color: #1790ff;
      }
    }
  }
  .pager-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
.lock-modal-content {
  text-align: center;
  font-size: 16px;
}
</style>