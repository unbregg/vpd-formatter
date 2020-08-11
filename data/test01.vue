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
  },
  watch: {
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
  // created() {
  //   const { bgId, buId, busiId } = resolveQueryParams(location.href);
  //   if (bgId && buId && busiId) {
  //     this.biz = { bg: [parseInt(bgId)], bu: [parseInt(buId)], biz: [parseInt(busiId)] };
  //   }
  // }
  cancelAll () {
    this.selectTarget = [];
  }
  onBizChange({ biz }) {
    if (!this.isApprovalProcess) return;
    const bizId = biz[0] ? biz[0].busiId : '';
    if (bizId && bizId !== this.selectedBizId) {
      this.selectedBizId = bizId;
      api.myBudget.fetchPreConfigInfo({
        budgetId: this.budgetDetail.id,
        busiId: bizId,
      }).then(({ data }) => {
        this.curPreConfigInfo = data;
      });
    }
  }
  compareUp (prop) { // 基于对象中的prop属性升序排列
    return function (a, b) {
      let value1 = a[prop];
      let value2 = b[prop];
      if (!a[prop]) {
        value1 = 9999;
      }
      if (!b[prop]) {
        value2 = 9999;
      }
      return value1 - value2;
    };
  }
  compareGroupUp (prop) { // 基于对象中的prop属性升序排列
    return function (a, b) {
      let value1 = TGROUP_ORDER[a['$target'][prop]];
      let value2 = TGROUP_ORDER[b['$target'][prop]];
      if (!TGROUP_ORDER[a['$target'][prop]]) {
        value1 = 9999;
      }
      if (!TGROUP_ORDER[b['$target'][prop]]) {
        value2 = 9999;
      }
      return value1 - value2;
    };
  }
  getGroupData (index) { // 点击tab获取该组下的数据，已经点过的不重复获取
    if (typeof this.getBizData(this.biz.biz[0]).dataCellList.find((val) => { return val.$target.groupName === index; }) === 'undefined') {
      const groupId = this.divideTargetList(this.getBizData(this.biz.biz[0]).targetList).find((item) => { return item.$target.groupName === index; }).$target.groupId;
      (this as any).fetchBizData({ biz: this.biz.biz[0], type: 1, groupId: groupId });
    }
  }
  divideTargetGroup (arr) {
    const newArr = [];
    const firstGroup = [];
    const secondGroup = [];
    arr.forEach((item) => {
      if (item.$target.groupName === '综合信息') {
        firstGroup.push(item);
      } else {
        secondGroup.push(item);
      }
    });
    newArr.push(firstGroup);
    newArr.push(secondGroup);
    return newArr;
  }
  sortTargetList(targetList: TargetCard[]) {
    sort(targetList, (target1: TargetCard, target2: TargetCard) => {
      return target1.sort > target2.sort;
    });
    return targetList;
  }

  getAggBizDataCellList(list: DataCell[]): {}[] {
    return aggBizDateCellList(list);
  }

  getBizData(biz: Biz): BizData { // 取得对应子业务的bizData
    const bizDataList = (this as any).bizDataList as BizData[];
    const bizData = bizDataList.find((item) => item.biz.busiId === biz.busiId); // 把该子业务对应的bizData取出来 里面有biz dataCellList(各个单元格有target字段) loading targetList
    if (!bizData) return;
    return bizData;
  }
  handleStartConfigClick() { // 点击开始配置时
    this.activeIndex = '电话';
    if (!get(this.biz, 'biz[0]')) return this.$Message.warning('请选择子业务！');
    (this as any).updateTopQuery({ biz: this.biz });
    if ((this as any).budgetDetail.budgetGranularity === TimeGranularity.YEAR) {
      (this as any).fetchBizData({ biz: this.biz.biz[0], type: 0 });
      (this as any).fetchPlanTypeEnums();
    } else { // 月度和时段只从接口获取target信息
      (this as any).fetchBizData({ biz: this.biz.biz[0], type: 1 });
    }
  }
  handleRejectClick () {
    const that = this as any;
    const budgetDetail = that.budgetDetail;
    if (!get(this.biz, 'biz[0]')) return this.$Message.warning('请选择子业务！');
    (this as any).saveBudgetConfig({}).then(data => { // 先保存
    }).catch(err => {
      this.$Message.error(err && err.message);
    });
    axios.post('rejectBudgetAdjustValueByParam', { // 再驳回
      budgetId: budgetDetail.id,
      desc: 'reject',
    }, {
      loading: true,
    } as any).then(res => {
      if (!res.data) return this.$Message.error('操作失败');
      this.$Message.success('操作成功');
      this.$router.replace({ name: 'proms-budgets-list' });
    });
  }
  divideGroupTargetList (val) { // 为全量数组表分组
    const groupObj = {};
    val.forEach((item) => {
      if (item.visible === 1) {
        if (typeof groupObj[item.groupName] === 'undefined') {
          groupObj[item.groupName] = [];
          groupObj[item.groupName].push(item);
        } else {
          groupObj[item.groupName].push(item);
        }
      }
    });
    for (const item in groupObj) { // 指标排序，主要用于趋势图指标筛选里的顺序
      groupObj[item].sort(this.compareUp('sort'));
    }
    return groupObj; // 该组下的所有target 组名：[{}]
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
  handleUploadClick() {
    if (!get(this.biz, 'biz[0]')) return this.$Message.warning('请选择子业务！');
    const fileInput = this.$refs.fileInput as any;
    const that = this as any;

    fileInput.onchange = ({ target }) => {
      const file = target.files[0];
      target.value = '';
      const formData = new FormData();
      formData.append('file', file);
      axios.post(`uploadBusiBudget?budgetId=${that.budgetDetail.id}&busiId=${this.biz.biz[0].busiId}`, formData, {
        loading: true,
      } as any).then(res => {
        this.handleStartConfigClick();
      });
    };
    fileInput.click();
  }
  targetList = [];
  downloadModal = false;
  selectTarget = [];// 初始要下载的指标为editable=1
  selectTargetObjectList = [];
  handleDownloadTemplateClick() {
    if (this.biz.bu.length === 0) {
      this.$Message.warning('请选择子业务！');
    } else {
      if ((this as any).budgetDetail.budgetGranularity === TimeGranularity.YEAR) {
        axios.get('selectTargetTypeByBusiIdDownload', {
          params: {
            budgetId: (this as any).budgetDetail.id,
            busiId: this.biz.biz[0].busiId,
          },
        })
          .then((res) => {
            this.targetList = res.data;
            // this.selectTarget = this.targetList.filter((item) => {return item.editable===1}).map((item) => {return item.targetTypeId})
            this.selectTarget = this.targetList.map((item) => { return item.targetTypeId; });
            this.downloadModal = true;
          });
      } else {
        if (this.biz.biz.length !== 0) {
          axios.get('downloadPreTypeModule', {
            params: {
              budgetId: (this as any).budgetDetail.id,
              busiId: this.biz.biz[0].busiId,
            },
            responseType: 'blob',
          }).then((res: any) => {
            downloadExcelByFileBuffer(res, '子业务预测上传表.xls');
          });
        } else {
          this.$Message.error('请选择子业务');
        }
      }
    }
  }
  submitDownloadTarget () {
    this.selectTargetObjectList = [];
    this.targetList.forEach((item) => {
      for (const val of this.selectTarget) {
        // eslint-disable-next-line
        if (item.targetTypeId == val) {
          this.selectTargetObjectList.push(item);
        }
      }
    });
    const params = {
      budgetId: (this as any).budgetDetail.id,
      busiGroupRelations: this.selectTargetObjectList,
    };
    axios.post('downloadBusiBudgetModule', params, { responseType: 'arraybuffer' }).then((res: any) => {
      downloadExcelByFileBuffer(res, '子业务预测上传表.xls');
    }).catch(err => {
      this.$Message.error(err);
    });
  }

  handleBizcollapseChange(collapsed: boolean, biz: Biz) {
    // if (!collapsed) {
    //   (this as any).fetchBizData({biz});
    // }
  }

  handleSaveClick: any = debounce(this.handleSave, 300, { leading: true, trailing: false });

  handleSave() {
    (this as any).saveBudgetConfig({}).then(data => {
      this.handleStartConfigClick();
      this.$Message.success('已保存');
    }).catch(err => {
      this.$Message.error(err && err.message);
    });
  }

  handleCalcClick (biz) {
    (this as any).calcAndRefreshDizData({ biz });
  }

  confirm(options) {
    const { title, placeholder, onOk } = options;
    let value = '';
    this.$Modal.confirm({
      title,
      render: (h) => {
        return h('Input', {
          props: {
            autofocus: true,
            placeholder: placeholder || '请输入...',
            type: 'textarea',
            rows: 4,
            maxlength: 200,
            value,
            loading: true,
          },
          on: {
            input: (val) => {
              value = val;
            },
          },
        });
      },
      onOk: () => {
        if (typeof onOk === 'function') {
          const promise = onOk(value);
          if (promise instanceof Promise) {
            promise.finally(() => this.$Modal.remove());
          } else {
            this.$Modal.remove();
          }
        }
      },
    });
  }

  handleSubmitClick() {
    this.confirm({
      title: '提交审批',
      placeholder: '请输入200字以内描述',
      onOk: async (desc) => {
        await this.submitBudgetConfig({ desc, busiId: this.selectedBizId }); // 提交
        this.$Message.success(`预测${this.mode === 'config' ? '配置' : '调整'}提交成功`);
        this.$router.replace({ name: 'proms-budgets-list' });
      },
    });
  }

  // 锁量通过
  handleLockApproveClick() {
    const params = { budgetId: (this as any).budgetDetail.id, lockTaskId: (this as any).budgetDetail.lockTaskId, status: 0 };
    axios.post('budgetlock/approveBudgetLock', qs.stringify(params), { loading: true } as any).then(({ data }) => {
      if (data) {
        this.$Message.success('锁量通过操作成功');
        this.$router.push({ path: '/proms-budgets' });
      }
      if (!data) this.$Message.error('锁量通过操作失败');
    });
  }

  // 锁量驳回
  handleLockRejectClick() {
    this.lockRejectModal = true;
    this.lockRejectReason = '';
  }

  // 驳回确定按钮
  handleLockRejectOk() {
    if (!this.lockRejectReason) return this.$Message.error('请填写驳回原因');
    const params = { budgetId: (this as any).budgetDetail.id, lockTaskId: (this as any).budgetDetail.lockTaskId, status: 1, reason: this.lockRejectReason };
    axios.post('budgetlock/approveBudgetLock', qs.stringify(params), { loading: true } as any).then(({ data }) => {
      if (data) {
        this.$Message.success('锁量驳回操作成功');
        this.$router.push({ path: '/proms-budgets' });
      }
      if (!data) this.$Message.error('锁量驳回操作失败');
      this.lockRejectModal = false;
    }).catch(() => { this.lockRejectModal = true; });
  }

  approve(auditResult) {
    this.confirm({
      title: auditResult === AuditResult.ACCEPT ? '通过' : '驳回',
      onOk: (value: string) => {
        const { curPreConfigInfo } = this;
        const { budgetId, gravityId } = curPreConfigInfo;
        const params = {
          auditResult,
          budgetDate: this.topQuery.configDate ? new Date(this.topQuery.configDate).getTime() : undefined,
          budgetId,
          busiId: this.selectedBizId,
          gravityId,
          reason: value,
        };
        api.myBudget.approvePreBudgetValue(params).then(() => {
          this.$Message.success('审批成功');
          this.$router.push({ path: '/proms-budgets' });
        }).catch((e: Error) => {
          filterHttpSuccessErrors(e);
          this.$Message.error('审批失败');
        });
      },
    });
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
